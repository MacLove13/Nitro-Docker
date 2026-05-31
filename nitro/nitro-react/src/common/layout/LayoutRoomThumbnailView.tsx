import { FC, useMemo } from 'react';
import { GetConfiguration } from '../../api';
import { Base, BaseProps } from '../Base';

export interface LayoutRoomThumbnailViewProps extends BaseProps<HTMLDivElement>
{
    roomId?: number;
    customUrl?: string;
    cacheBuster?: number;
}

export const LayoutRoomThumbnailView: FC<LayoutRoomThumbnailViewProps> = props =>
{
    const { roomId = -1, customUrl = null, cacheBuster = 0, shrink = true, overflow = 'hidden', classNames = [], children = null, ...rest } = props;

    const getClassNames = useMemo(() =>
    {
        const newClassNames: string[] = [ 'room-thumbnail', 'rounded', 'border' ];

        if(classNames.length) newClassNames.push(...classNames);

        return newClassNames;
    }, [ classNames ]);

    const getImageUrl = useMemo(() =>
    {
        if(customUrl && customUrl.length) return (GetConfiguration<string>('image.library.url') + customUrl);

        const base = GetConfiguration<string>('thumbnails.url').replace('%thumbnail%', roomId.toString());
        return cacheBuster > 0 ? (base + '?v=' + cacheBuster) : base;
    }, [ customUrl, roomId, cacheBuster ]);

    return (
        <Base shrink={ shrink } overflow={ overflow } classNames={ getClassNames } { ...rest }>
            { getImageUrl && <img alt="" src={ getImageUrl } /> }
            { children }
        </Base>
    );
}
