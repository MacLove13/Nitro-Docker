import { FC, DragEvent, useRef, useState } from 'react';
import { GetDiskColor, GetNitroInstance, LocalizeText } from '../../../../../api';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../../../../common';
import { buildTrackCode, playSamplePreview, TRAX_MAX_CARTRIDGES, TRAX_STEPS, TRAX_TRACKS, useFurnitureSoundMachineWidget } from '../../../../../hooks';

// Habbo classic 3x3 pad colours (indexed 0–8, left-to-right, top-to-bottom)
const PAD_COLORS: string[] = [
    '#f0a028', '#f0a028', '#d4b020',
    '#72b040', '#f0a028', '#72b040',
    '#72b040', '#f0a028', '#72b040',
];

const DISCS_PER_PAGE = 3;

// ── Pad button ──────────────────────────────────────────────────────────────
interface TraxPadProps {
    color: string | null;
    sampleId: number | null;
    onHoverStart: (id: number) => void;
    onHoverEnd: () => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void;
}

const TraxPad: FC<TraxPadProps> = ({ color, sampleId, onHoverStart, onHoverEnd, onDragStart }) => (
    <div
        className={ `trax-pad${ color ? ' loaded' : ' empty' }` }
        style={ color ? { background: color } : undefined }
        draggable={ color !== null && sampleId !== null }
        onMouseEnter={ () => { if (sampleId !== null) onHoverStart(sampleId); } }
        onMouseLeave={ onHoverEnd }
        onDragStart={ e => { if (sampleId !== null) onDragStart(e, sampleId); } }
    />
);

// ── Cartridge slot ──────────────────────────────────────────────────────────
interface CartridgeSlotProps {
    diskId: number | undefined;
    samples: number[];
    songName: string;
    onRemove: () => void;
    onHoverStart: (id: number) => void;
    onHoverEnd: () => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void;
}

const CartridgeSlot: FC<CartridgeSlotProps> = ({ diskId, samples, songName, onRemove, onHoverStart, onHoverEnd, onDragStart }) =>
{
    const loaded = diskId !== undefined;

    return (
        <div className={ `trax-cartridge${ loaded ? ' loaded' : ' empty' }` }>
            <div className="trax-cartridge-name" title={ loaded ? songName : '' }>
                { loaded ? songName : '' }
            </div>
            <div className="trax-cartridge-pads">
                { Array.from({ length: 9 }).map((_, i) => (
                    <TraxPad
                        key={ i }
                        color={ loaded ? PAD_COLORS[i] : null }
                        sampleId={ loaded ? (samples[i] ?? null) : null }
                        onHoverStart={ onHoverStart }
                        onHoverEnd={ onHoverEnd }
                        onDragStart={ onDragStart }
                    />
                )) }
            </div>
            { loaded && (
                <button className="trax-cartridge-eject" onClick={ onRemove } title="Eject">✕</button>
            ) }
        </div>
    );
};

// ── Sequencer cell ──────────────────────────────────────────────────────────
interface SeqCellProps {
    track: number;
    step: number;
    sampleId: number | null;
    onDrop: (track: number, step: number, sampleId: number) => void;
    onClear: (track: number, step: number) => void;
}

const SeqCell: FC<SeqCellProps> = ({ track, step, sampleId, onDrop, onClear }) =>
{
    const [ over, setOver ] = useState(false);

    return (
        <div
            className={ `trax-seq-cell${ sampleId !== null ? ' filled' : '' }${ over ? ' over' : '' }` }
            style={ sampleId !== null ? { background: PAD_COLORS[sampleId % PAD_COLORS.length] } : undefined }
            onDragOver={ e => { e.preventDefault(); setOver(true); } }
            onDragLeave={ () => setOver(false) }
            onDrop={ e => {
                e.preventDefault();
                setOver(false);
                const id = parseInt(e.dataTransfer.getData('sampleId'), 10);
                if (!isNaN(id)) onDrop(track, step, id);
            } }
            onClick={ () => sampleId !== null && onClear(track, step) }
        />
    );
};

// ── Main widget ─────────────────────────────────────────────────────────────
export const FurnitureSoundMachineWidgetView: FC<{}> = () =>
{
    const {
        objectId, isOpen, diskInventory, selectedDiskIds,
        timeline, trackName, isPlaying,
        onClose, toggleDisk, getSamplesForDisk,
        dropSampleOnStep, clearStep, clearTimeline,
        saveSong, previewPlay, stopPreview, setTrackName, getSongName,
    } = useFurnitureSoundMachineWidget();

    const [ discPage, setDiscPage ] = useState(0);
    const [ isLoopEnabled, setIsLoopEnabled ] = useState(false);
    const stopSampleRef = useRef<(() => void) | null>(null);

    if (!isOpen || objectId === -1) return null;

    const diskIds: number[] = diskInventory?.getKeys() ?? [];
    const totalPages = Math.max(1, Math.ceil(diskIds.length / DISCS_PER_PAGE));
    const pageDiskIds = diskIds.slice(discPage * DISCS_PER_PAGE, (discPage + 1) * DISCS_PER_PAGE);

    const handlePadHoverStart = (sampleId: number) =>
    {
        if (stopSampleRef.current) stopSampleRef.current();
        stopSampleRef.current = playSamplePreview(sampleId);
    };

    const handlePadHoverEnd = () =>
    {
        if (stopSampleRef.current) { stopSampleRef.current(); stopSampleRef.current = null; }
    };

    const handleDragStart = (e: DragEvent<HTMLDivElement>, sampleId: number) =>
    {
        e.dataTransfer.setData('sampleId', String(sampleId));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const getDiskIconColor = (diskId: number): string =>
    {
        const ctrl = (GetNitroInstance().soundManager as any)?.musicController;
        if (!ctrl) return '#4a6a80';
        const songId = diskInventory.getValue(diskId) as number | undefined;
        if (songId === undefined || songId === null) return '#4a6a80';
        const info = ctrl.getSongInfo(songId);
        return info?.songData ? GetDiskColor(info.songData) : '#4a6a80';
    };

    const habboCode = buildTrackCode(timeline);

    return (
        <NitroCardView className="nitro-sound-machine-widget" theme="primary-slim" style={{ width: 600 }}>
            <NitroCardHeaderView headerText={ LocalizeText('soundmachine.title') || 'Trax Editor' } onCloseClick={ onClose } />
            <NitroCardContentView overflow="hidden">
                <div className="trax-layout">

                    {/* ── Left panel: disc inventory ───────────────────── */}
                    <div className="trax-left">
                        <div className="trax-disc-list">
                            { pageDiskIds.length === 0 && (
                                <div className="trax-no-discs">{ LocalizeText('soundmachine.no.discs') || 'No discs' }</div>
                            ) }
                            { pageDiskIds.map(diskId =>
                            {
                                const selected = selectedDiskIds.includes(diskId);
                                return (
                                    <div
                                        key={ diskId }
                                        className={ `trax-disc-item${ selected ? ' selected' : '' }` }
                                        onClick={ () => toggleDisk(diskId) }
                                    >
                                        <div className="trax-disc-thumb" style={{ background: getDiskIconColor(diskId) }} />
                                        <span className="trax-disc-name">{ getSongName(diskId) }</span>
                                    </div>
                                );
                            }) }
                        </div>
                        <div className="trax-disc-nav">
                            <span className="trax-nav-disc-icon" />
                            <button
                                className="trax-nav-btn"
                                disabled={ discPage === 0 }
                                onClick={ () => setDiscPage(p => Math.max(0, p - 1)) }
                            >{'<'}</button>
                            <span className="trax-nav-page">{ discPage + 1 }/{ totalPages }</span>
                            <button
                                className="trax-nav-btn"
                                disabled={ discPage >= totalPages - 1 }
                                onClick={ () => setDiscPage(p => Math.min(totalPages - 1, p + 1)) }
                            >{'>'}</button>
                        </div>
                    </div>

                    {/* ── Main area ────────────────────────────────────── */}
                    <div className="trax-main">

                        {/* Cartridge slots */}
                        <div className="trax-cartridge-row">
                            { Array.from({ length: TRAX_MAX_CARTRIDGES }).map((_, i) =>
                            {
                                const diskId = selectedDiskIds[i];
                                return (
                                    <CartridgeSlot
                                        key={ i }
                                        diskId={ diskId }
                                        samples={ diskId !== undefined ? getSamplesForDisk(diskId) : [] }
                                        songName={ diskId !== undefined ? getSongName(diskId) : '' }
                                        onRemove={ () => diskId !== undefined && toggleDisk(diskId) }
                                        onHoverStart={ handlePadHoverStart }
                                        onHoverEnd={ handlePadHoverEnd }
                                        onDragStart={ handleDragStart }
                                    />
                                );
                            }) }
                        </div>

                        {/* Transport controls */}
                        <div className="trax-transport">
                            <button
                                className={ `trax-tbt play${ isPlaying ? ' active' : '' }` }
                                onClick={ isPlaying ? stopPreview : previewPlay }
                                title={ isPlaying ? 'Stop' : 'Play' }
                            />
                            <button className="trax-tbt stop" onClick={ stopPreview } title="Stop" />
                            <button
                                className={ `trax-tbt loop${ isLoopEnabled ? ' active' : '' }` }
                                title={ isLoopEnabled ? 'Disable loop' : 'Enable loop' }
                                onClick={ () => setIsLoopEnabled(prev => !prev) }
                            />
                            <button className="trax-tbt rec" title="Record (not available)" disabled />
                            <button className="trax-tbt clear" onClick={ clearTimeline } title="Clear timeline" />
                            <button
                                className="trax-tbt nav-prev"
                                title="Previous page"
                                disabled={ discPage === 0 }
                                onClick={ () => setDiscPage(p => Math.max(0, p - 1)) }
                            />
                            <button
                                className="trax-tbt nav-next"
                                title="Next page"
                                disabled={ discPage >= totalPages - 1 }
                                onClick={ () => setDiscPage(p => Math.min(totalPages - 1, p + 1)) }
                            />
                        </div>

                        {/* Sequencer grid */}
                        <div className="trax-sequencer">
                            { Array.from({ length: TRAX_TRACKS }).map((_, track) => (
                                <div key={ track } className="trax-seq-row">
                                    <div className="trax-seq-num">{ track + 1 }</div>
                                    <div className="trax-seq-cells">
                                        { Array.from({ length: TRAX_STEPS }).map((_, step) => (
                                            <SeqCell
                                                key={ step }
                                                track={ track }
                                                step={ step }
                                                sampleId={ timeline[track][step] }
                                                onDrop={ dropSampleOnStep }
                                                onClear={ clearStep }
                                            />
                                        )) }
                                    </div>
                                </div>
                            )) }
                            <div className="trax-time-axis">
                                <div className="trax-time-pad" />
                                { ['0:10', '0:20', '0:30', '0:40'].map(t => (
                                    <div key={ t } className="trax-time-tick">{ t }</div>
                                )) }
                            </div>
                        </div>

                        {/* Output format + track name/save */}
                        <div className="trax-output">
                            <div className="trax-output-label">
                                { LocalizeText('soundmachine.format') || 'Music in Habbo format' }
                            </div>
                            <div className="trax-output-row">
                                <input
                                    className="trax-track-name"
                                    type="text"
                                    placeholder={ LocalizeText('soundmachine.track.name') || 'Track name…' }
                                    value={ trackName }
                                    maxLength={ 64 }
                                    onChange={ e => setTrackName(e.target.value) }
                                />
                                <button
                                    className="trax-save-btn"
                                    disabled={ !trackName.trim() }
                                    onClick={ saveSong }
                                >{ LocalizeText('generic.save') || 'Save' }</button>
                            </div>
                            <input
                                className="trax-habbo-code"
                                type="text"
                                readOnly
                                value={ habboCode }
                            />
                        </div>
                    </div>
                </div>
            </NitroCardContentView>
        </NitroCardView>
    );
};
