import { FC, DragEvent, useRef, useState } from 'react';
import { LocalizeText } from '../../../../../api';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../../../../common';
import { useFurnitureSoundMachineWidget, playSamplePreview, TRAX_TRACKS, TRAX_STEPS, TRAX_MAX_CARTRIDGES } from '../../../../../hooks';

const STEP_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63',
    '#00bcd4', '#8bc34a', '#ff5722', '#607d8b',
    '#795548', '#9c27b0', '#03a9f4', '#cddc39'
];

const getSampleColor = (sampleId: number): string =>
    STEP_COLORS[sampleId % STEP_COLORS.length];

interface PadProps {
    sampleId: number;
    onHoverStart: (id: number) => void;
    onHoverEnd: (id: number) => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void;
}

const Pad: FC<PadProps> = ({ sampleId, onHoverStart, onHoverEnd, onDragStart }) => (
    <div
        className="trax-pad"
        style={{ background: getSampleColor(sampleId) }}
        draggable
        onMouseEnter={ () => onHoverStart(sampleId) }
        onMouseLeave={ () => onHoverEnd(sampleId) }
        onDragStart={ e => onDragStart(e, sampleId) }
        title={ `Sample ${sampleId}` }
    >
        <span className="trax-pad-label">{ sampleId }</span>
    </div>
);

interface CartridgeProps {
    diskId: number;
    samples: number[];
    songName: string;
    isSelected: boolean;
    onToggle: () => void;
    onHoverStart: (id: number) => void;
    onHoverEnd: (id: number) => void;
    onDragStart: (e: DragEvent<HTMLDivElement>, id: number) => void;
}

const CartridgeView: FC<CartridgeProps> = ({ diskId, samples, songName, isSelected, onToggle, onHoverStart, onHoverEnd, onDragStart }) => (
    <div className={ `trax-cartridge ${ isSelected ? 'selected' : '' }` } onClick={ onToggle }>
        <div className="trax-cartridge-header">{ songName }</div>
        { isSelected && (
            <div className="trax-pads-grid">
                { samples.slice(0, 9).map((sid, i) => (
                    <Pad
                        key={ i }
                        sampleId={ sid }
                        onHoverStart={ onHoverStart }
                        onHoverEnd={ onHoverEnd }
                        onDragStart={ onDragStart }
                    />
                )) }
                { Array.from({ length: Math.max(0, 9 - samples.slice(0, 9).length) }).map((_, i) => (
                    <div key={ `empty-${i}` } className="trax-pad trax-pad-empty" />
                )) }
            </div>
        ) }
    </div>
);

interface TimelineCellProps {
    track: number;
    step: number;
    sampleId: number | null;
    onDrop: (track: number, step: number, sampleId: number) => void;
    onClear: (track: number, step: number) => void;
}

const TimelineCell: FC<TimelineCellProps> = ({ track, step, sampleId, onDrop, onClear }) => {
    const [ dragOver, setDragOver ] = useState(false);

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const id = parseInt(e.dataTransfer.getData('sampleId'), 10);
        if (!isNaN(id)) onDrop(track, step, id);
    };

    return (
        <div
            className={ `trax-cell ${ sampleId !== null ? 'filled' : '' } ${ dragOver ? 'drag-over' : '' }` }
            style={ sampleId !== null ? { background: getSampleColor(sampleId) } : undefined }
            onDragOver={ handleDragOver }
            onDragLeave={ handleDragLeave }
            onDrop={ handleDrop }
            onClick={ () => sampleId !== null && onClear(track, step) }
            title={ sampleId !== null ? `Sample ${sampleId} (click to remove)` : undefined }
        />
    );
};

export const FurnitureSoundMachineWidgetView: FC<{}> = () =>
{
    const {
        objectId,
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
    } = useFurnitureSoundMachineWidget();

    const stopSampleRef = useRef<(() => void) | null>(null);

    if (objectId === -1) return null;

    const diskIds: number[] = diskInventory?.getKeys() ?? [];

    const handlePadHoverStart = (sampleId: number) => {
        if (stopSampleRef.current) stopSampleRef.current();
        stopSampleRef.current = playSamplePreview(sampleId);
    };

    const handlePadHoverEnd = (_sampleId: number) => {
        if (stopSampleRef.current) {
            stopSampleRef.current();
            stopSampleRef.current = null;
        }
    };

    const handleDragStart = (e: DragEvent<HTMLDivElement>, sampleId: number) => {
        e.dataTransfer.setData('sampleId', String(sampleId));
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <NitroCardView className="nitro-sound-machine-widget" theme="primary-slim" style={{ width: 700, minHeight: 420 }}>
            <NitroCardHeaderView headerText={ LocalizeText('soundmachine.title') || 'Trax Machine' } onCloseClick={ onClose } />
            <NitroCardContentView>
                <div className="trax-editor">
                    {/* Left: disc inventory list */}
                    <div className="trax-discs">
                        <div className="trax-section-title">{ LocalizeText('soundmachine.discs') || 'Discs' }</div>
                        <div className="trax-disc-list">
                            { diskIds.length === 0 && (
                                <div className="trax-empty">{ LocalizeText('soundmachine.no.discs') || 'No discs in inventory' }</div>
                            ) }
                            { diskIds.map(diskId => {
                                const isSelected = selectedDiskIds.includes(diskId);
                                return (
                                    <div
                                        key={ diskId }
                                        className={ `trax-disc-item ${ isSelected ? 'selected' : '' }` }
                                        onClick={ () => toggleDisk(diskId) }
                                    >
                                        <div className="trax-disc-name">{ getSongName(diskId) }</div>
                                        { isSelected && <span className="trax-disc-slot">{ (selectedDiskIds.indexOf(diskId) + 1) }</span> }
                                    </div>
                                );
                            }) }
                        </div>
                    </div>

                    {/* Center: cartridges + sequencer */}
                    <div className="trax-main">
                        {/* Cartridge row */}
                        <div className="trax-cartridges">
                            { Array.from({ length: TRAX_MAX_CARTRIDGES }).map((_, i) => {
                                const diskId = selectedDiskIds[i];
                                if (diskId === undefined) {
                                    return (
                                        <div key={ i } className="trax-cartridge empty">
                                            <div className="trax-cartridge-header">–</div>
                                        </div>
                                    );
                                }
                                return (
                                    <CartridgeView
                                        key={ diskId }
                                        diskId={ diskId }
                                        samples={ getSamplesForDisk(diskId) }
                                        songName={ getSongName(diskId) }
                                        isSelected={ true }
                                        onToggle={ () => toggleDisk(diskId) }
                                        onHoverStart={ handlePadHoverStart }
                                        onHoverEnd={ handlePadHoverEnd }
                                        onDragStart={ handleDragStart }
                                    />
                                );
                            }) }
                        </div>

                        {/* Sequencer */}
                        <div className="trax-sequencer">
                            { Array.from({ length: TRAX_TRACKS }).map((_, track) => (
                                <div key={ track } className="trax-track">
                                    <div className="trax-track-label">{ track + 1 }</div>
                                    { Array.from({ length: TRAX_STEPS }).map((_, step) => (
                                        <TimelineCell
                                            key={ step }
                                            track={ track }
                                            step={ step }
                                            sampleId={ timeline[track][step] }
                                            onDrop={ dropSampleOnStep }
                                            onClear={ clearStep }
                                        />
                                    )) }
                                </div>
                            )) }
                        </div>

                        {/* Controls */}
                        <div className="trax-controls">
                            <input
                                className="trax-name-input"
                                type="text"
                                placeholder={ LocalizeText('soundmachine.track.name') || 'Track name...' }
                                value={ trackName }
                                maxLength={ 64 }
                                onChange={ e => setTrackName(e.target.value) }
                            />
                            <button className="btn btn-sm btn-success" onClick={ isPlaying ? stopPreview : previewPlay }>
                                { isPlaying ? '⏹' : '▶' }
                            </button>
                            <button className="btn btn-sm btn-secondary" onClick={ clearTimeline }>
                                { LocalizeText('generic.clear') || 'Clear' }
                            </button>
                            <button
                                className="btn btn-sm btn-primary"
                                disabled={ !trackName.trim() }
                                onClick={ saveSong }
                            >
                                { LocalizeText('generic.save') || 'Save' }
                            </button>
                        </div>
                    </div>
                </div>
            </NitroCardContentView>
        </NitroCardView>
    );
};
