import { NitroConfiguration, RoomEngineObjectEvent, RoomEngineTriggerWidgetEvent, RoomObjectCategory, RoomObjectVariable } from '@nitrots/nitro-renderer';
import { useState } from 'react';
import { GetRoomEngine, IPhotoData } from '../../../../api';
import { useRoomEngineEvent } from '../../../events';
import { useFurniRemovedEvent } from '../../engine';
import { useRoom } from '../../useRoom';

const rewritePhotoUrl = (photo: IPhotoData): IPhotoData =>
{
    if(!photo?.w) return photo;
    try
    {
        const cameraUrl = NitroConfiguration.getValue<string>('camera.url', '');
        if(!cameraUrl) return photo;
        const cameraBase = new URL(cameraUrl);
        const photoUrl = new URL(photo.w);
        photoUrl.hostname = cameraBase.hostname;
        photoUrl.port = cameraBase.port;
        photoUrl.protocol = cameraBase.protocol;
        return { ...photo, w: photoUrl.toString() };
    }
    catch(e)
    {
        return photo;
    }
};

const useFurnitureExternalImageWidgetState = () =>
{
    const [ objectId, setObjectId ] = useState(-1);
    const [ category, setCategory ] = useState(-1);
    const [ currentPhotoIndex, setCurrentPhotoIndex ] = useState(-1);
    const [ currentPhotos, setCurrentPhotos ] = useState<IPhotoData[]>([]);
    const { roomSession = null } = useRoom();

    const onClose = () =>
    {
        setObjectId(-1);
        setCategory(-1);
        setCurrentPhotoIndex(-1);
        setCurrentPhotos([]);
    }

    // Fix photo URL host as soon as the wall object is added to the room,
    // BEFORE FurnitureExternalImageVisualization caches the _small URL on the first render tick.
    useRoomEngineEvent<RoomEngineObjectEvent>(RoomEngineObjectEvent.ADDED, event =>
    {
        if(event.category !== RoomObjectCategory.WALL) return;

        const object = GetRoomEngine().getRoomObject(event.roomId, event.objectId, event.category);

        if(!object || object.type !== 'external_image_wallitem_poster_small') return;

        const data = object.model.getValue<string>(RoomObjectVariable.FURNITURE_DATA);

        if(!data) return;

        const json: IPhotoData = JSON.parse(data);
        const fixed = rewritePhotoUrl(json);

        if(fixed?.w && fixed.w !== json.w)
        {
            object.model.setValue<string>(RoomObjectVariable.FURNITURE_DATA, JSON.stringify({ ...json, w: fixed.w }));
        }
    });

    useRoomEngineEvent<RoomEngineTriggerWidgetEvent>(RoomEngineTriggerWidgetEvent.REQUEST_EXTERNAL_IMAGE, event =>
    {
        const roomObject = GetRoomEngine().getRoomObject(event.roomId, event.objectId, event.category);
        const roomTotalImages = GetRoomEngine().getRoomObjects(roomSession?.roomId, RoomObjectCategory.WALL);

        if(!roomObject) return;

        const datas: IPhotoData[] = [];

        roomTotalImages.forEach(object =>
        {
            if (object.type !== 'external_image_wallitem_poster_small') return null;

            const data = object.model.getValue<string>(RoomObjectVariable.FURNITURE_DATA);
            const jsonData: IPhotoData = rewritePhotoUrl(JSON.parse(data));

            // Rewrite the model value so the renderer (FurnitureExternalImageVisualization)
            // fetches the _small URL from the correct host instead of localhost.
            if(jsonData?.w)
            {
                const rewritten = JSON.stringify({ ...JSON.parse(data), w: jsonData.w });
                object.model.setValue<string>(RoomObjectVariable.FURNITURE_DATA, rewritten);
            }

            datas.push(jsonData);
        });

        setObjectId(event.objectId);
        setCategory(event.category);
        setCurrentPhotos(datas);

        const roomObjectPhotoData = (JSON.parse(roomObject.model.getValue<string>(RoomObjectVariable.FURNITURE_DATA)) as IPhotoData);

        setCurrentPhotoIndex(prevValue =>
        {
            let index = 0;

            if(roomObjectPhotoData)
            {
                index = datas.findIndex(data => (data.u === roomObjectPhotoData.u))
            }

            if(index < 0) index = 0;

            return index;
        });
    });

    useFurniRemovedEvent(((objectId !== -1) && (category !== -1)), event =>
    {
        if((event.id !== objectId) || (event.category !== category)) return;

        onClose();
    });

    return { objectId, currentPhotoIndex, currentPhotos, onClose };
}

export const useFurnitureExternalImageWidget = useFurnitureExternalImageWidgetState;
