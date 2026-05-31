import { GetNitroInstance, GetConfiguration, GetConnection, GetRoomEngine } from '../../../../api';
import { MusicPriorities, RoomEngineTriggerWidgetEvent, RoomObjectSoundMachineEvent, SongDataEntry, SongDiskInventoryReceivedEvent, IAdvancedMap, AdvancedMap } from '@nitrots/nitro-renderer';
import { useCallback, useRef, useState } from 'react';
import { useRoomEngineEvent, useSoundEvent } from '../../../events';

/** Unique song ID used for in-editor preview playback */
const PREVIEW_SONG_ID = -999;

/** Number of tracks (channels) in the sequencer */
export const TRAX_TRACKS = 4;

/** Number of steps (columns) in the sequencer */
export const TRAX_STEPS = 16;

/** Maximum number of cartridges (discs) loaded at once */
export const TRAX_MAX_CARTRIDGES = 4;

export type TraxTimeline = (number | null)[][];

/** Step length in track units (each step is 2 units = one eighth note at default tempo) */
export const TRAX_STEP_LENGTH = 2;

class SaveTraxSongComposer {
    private _data: (string | number)[];
    constructor(songName: string, trackData: string) {
        this._data = [ songName, trackData ];
    }
    getMessageArray() { return this._data; }
    dispose() {}
}

export const buildTrackCode = (timeline: TraxTimeline): string => {
    const parts: string[] = [];
    for (let ch = 0; ch < TRAX_TRACKS; ch++) {
        const items = timeline[ch];
        const blocks: string[] = [];
        for (let step = 0; step < TRAX_STEPS; step++) {
            const sampleId = items[step] ?? 0;
            blocks.push(`${ sampleId },${ TRAX_STEP_LENGTH }`);
        }
        parts.push(`${ ch + 1 }:${ blocks.join(';') }`);
    }
    return parts.join(':') + ':';
};

export const playSamplePreview = (sampleId: number): (() => void) => {
    const url = GetConfiguration<string>('external.samples.url').replace('%sample%', String(sampleId));
    const audio = new Audio(url);
    audio.play().catch(() => {});
    return () => {
        audio.pause();
        audio.currentTime = 0;
    };
};

const useFurnitureSoundMachineWidgetState = () =>
{
    const [ objectId, setObjectId ] = useState(-1);
    const [ category, setCategory ] = useState(-1);
    const [ isOpen, setIsOpen ] = useState(false);
    const objectIdRef = useRef(-1);
    const [ diskInventory, setDiskInventory ] = useState<IAdvancedMap<number, number>>(new AdvancedMap());
    const [ selectedDiskIds, setSelectedDiskIds ] = useState<number[]>([]);
    const [ timeline, setTimeline ] = useState<TraxTimeline>(
        Array.from({ length: TRAX_TRACKS }, () => Array<number | null>(TRAX_STEPS).fill(null))
    );
    const [ trackName, setTrackName ] = useState('');
    const [ isPlaying, setIsPlaying ] = useState(false);
    const composerRegistered = useRef(false);

    const mc = useCallback(() => (GetNitroInstance().soundManager as any)?.musicController as any, []);

    const stopPreview = useCallback(() => {
        const ctrl = mc();
        if (ctrl) ctrl.stop(MusicPriorities.PRIORITY_PURCHASE_PREVIEW);
        setIsPlaying(false);
    }, [mc]);

    const onClose = useCallback(() => {
        stopPreview();
        objectIdRef.current = -1;
        setObjectId(-1);
        setCategory(-1);
        setIsOpen(false);
        setSelectedDiskIds([]);
        setTimeline(Array.from({ length: TRAX_TRACKS }, () => Array<number | null>(TRAX_STEPS).fill(null)));
        setTrackName('');
        setIsPlaying(false);
    }, [stopPreview]);

    useRoomEngineEvent<RoomObjectSoundMachineEvent>(RoomObjectSoundMachineEvent.JUKEBOX_INIT, event =>
    {
        const roomObject = GetRoomEngine().getRoomObject(event.roomId, event.objectId, event.category);
        if(!roomObject || !roomObject.type.startsWith('sound_machine')) return;
        objectIdRef.current = event.objectId;
        setObjectId(event.objectId);
        setCategory(event.category);
    });

    useRoomEngineEvent<RoomEngineTriggerWidgetEvent>(RoomEngineTriggerWidgetEvent.REQUEST_PLAYLIST_EDITOR, event =>
    {
        const roomObject = GetRoomEngine().getRoomObject(event.roomId, event.objectId, event.category);
        if(!roomObject || !roomObject.type.startsWith('sound_machine')) return;
        objectIdRef.current = event.objectId;
        setObjectId(event.objectId);
        setCategory(event.category);
        setIsOpen(true);
        GetNitroInstance().soundManager?.musicController?.requestUserSongDisks();
    });

    useRoomEngineEvent<RoomObjectSoundMachineEvent>(RoomObjectSoundMachineEvent.JUKEBOX_DISPOSE, _event =>
    {
        onClose();
    });

    useSoundEvent<SongDiskInventoryReceivedEvent>(SongDiskInventoryReceivedEvent.SDIR_SONG_DISK_INVENTORY_RECEIVENT_EVENT, _event =>
    {
        const inv = GetNitroInstance().soundManager?.musicController?.songDiskInventory?.clone();
        if (inv) setDiskInventory(inv);
    });

    const toggleDisk = useCallback((diskId: number) => {
        setSelectedDiskIds(prev => {
            if (prev.includes(diskId)) return prev.filter(id => id !== diskId);
            if (prev.length >= TRAX_MAX_CARTRIDGES) return [ ...prev.slice(1), diskId ];
            return [ ...prev, diskId ];
        });
    }, []);

    const getSamplesForDisk = useCallback((diskId: number): number[] => {
        const ctrl = mc();
        if (!ctrl) return [];
        const songId = diskInventory.getValue(diskId) as number | undefined;
        if (songId === undefined || songId === null) return [];
        const info = ctrl.getSongInfo(songId) as SongDataEntry | null;
        if (!info) return [];
        const songData: string = (info as any).songData ?? '';
        if (!songData) return [];
        const seen = new Set<number>();
        const parts = songData.split(':');
        for (let i = 0; i + 1 < parts.length; i += 2) {
            const items = parts[i + 1].split(';');
            for (const item of items) {
                const pair = item.split(',');
                if (pair.length >= 1) {
                    const sid = parseInt(pair[0], 10);
                    if (!isNaN(sid) && sid > 0) seen.add(sid);
                }
            }
        }
        return Array.from(seen);
    }, [diskInventory, mc]);

    const dropSampleOnStep = useCallback((track: number, step: number, sampleId: number) => {
        setTimeline(prev => {
            const next = prev.map(row => [...row]);
            next[track][step] = sampleId;
            return next;
        });
    }, []);

    const clearStep = useCallback((track: number, step: number) => {
        setTimeline(prev => {
            const next = prev.map(row => [...row]);
            next[track][step] = null;
            return next;
        });
    }, []);

    const clearTimeline = useCallback(() => {
        setTimeline(Array.from({ length: TRAX_TRACKS }, () => Array<number | null>(TRAX_STEPS).fill(null)));
    }, []);

    const ensureComposerRegistered = useCallback(() => {
        if (composerRegistered.current) return;
        composerRegistered.current = true;
        try {
            const conn = GetConnection() as any;
            conn.registerMessages({
                events: new Map(),
                composers: new Map([[3846, SaveTraxSongComposer]])
            });
        } catch (_e) {}
    }, []);

    const saveSong = useCallback(() => {
        const name = trackName.trim();
        if (!name) return;
        const trackCode = buildTrackCode(timeline);
        ensureComposerRegistered();
        try {
            GetConnection().send(new SaveTraxSongComposer(name, trackCode) as any);
        } catch (_e) {}
    }, [trackName, timeline, ensureComposerRegistered]);

    const previewPlay = useCallback(() => {
        const trackCode = buildTrackCode(timeline);
        const ctrl = mc();
        if (!ctrl) return;
        ctrl._availableSongs.set(PREVIEW_SONG_ID, new SongDataEntry(PREVIEW_SONG_ID, 32000, 'Preview', '', trackCode));
        ctrl.playSong(PREVIEW_SONG_ID, MusicPriorities.PRIORITY_PURCHASE_PREVIEW, 0, 0, 0.3, 0.3);
        setIsPlaying(true);
    }, [timeline, mc]);

    const getSongName = useCallback((diskId: number): string => {
        const ctrl = mc();
        if (!ctrl) return `Disc ${ diskId }`;
        const songId = diskInventory.getValue(diskId) as number | undefined;
        if (songId === undefined || songId === null) return `Disc ${ diskId }`;
        const info = ctrl.getSongInfo(songId) as SongDataEntry | null;
        return info?.name || `Disc ${ diskId }`;
    }, [diskInventory, mc]);

    return {
        objectId,
        isOpen,
        diskInventory,
        selectedDiskIds,
        timeline,
        trackName,
        isPlaying,
        onClose,
        toggleDisk,
        getSamplesForDisk,
        dropSampleOnStep,
        clearStep,
        clearTimeline,
        saveSong,
        previewPlay,
        stopPreview,
        setTrackName,
        getSongName
    };
};

export const useFurnitureSoundMachineWidget = useFurnitureSoundMachineWidgetState;

