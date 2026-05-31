import { NitroEvent } from '@nitrots/nitro-renderer';

export class RoomWidgetThumbnailEvent extends NitroEvent
{
    public static SHOW_THUMBNAIL: string = 'NE_SHOW_THUMBNAIL';
    public static HIDE_THUMBNAIL: string = 'NE_HIDE_THUMBNAIL';
    public static TOGGLE_THUMBNAIL: string = 'NE_TOGGLE_THUMBNAIL';
    public static THUMBNAIL_SAVED: string = 'NE_THUMBNAIL_SAVED';
}
