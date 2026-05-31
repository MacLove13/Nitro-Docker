import { FC, useEffect, useState } from 'react';
import { LocalizeText, WiredFurniType } from '../../../../api';
import { Column, Text } from '../../../../common';
import { useWired } from '../../../../hooks';
import { WiredActionBaseView } from './WiredActionBaseView';

const VARIABLE_TYPES = ['number', 'text', 'boolean', 'user'];

export const WiredActionGiveUserVariableView: FC<{}> = props =>
{
    const [ variableName, setVariableName ] = useState('');
    const [ variableType, setVariableType ] = useState('number');
    const [ defaultValue, setDefaultValue ] = useState('0');
    const [ isPersistent, setIsPersistent ] = useState(false);
    const [ valueToSet, setValueToSet ] = useState('0');
    const { trigger = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setStringParam([ variableName, variableType, defaultValue, String(isPersistent), valueToSet ].join('\t'));
    };

    useEffect(() =>
    {
        if(!trigger || !trigger.stringData) return;

        const parts = trigger.stringData.split('\t');
        if(parts.length >= 5)
        {
            setVariableName(parts[0] ?? '');
            setVariableType(parts[1] ?? 'number');
            setDefaultValue(parts[2] ?? '0');
            setIsPersistent(parts[3] === 'true');
            setValueToSet(parts[4] ?? '0');
        }
    }, [ trigger ]);

    return (
        <WiredActionBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.name') }</Text>
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={ variableName }
                    onChange={ event => setVariableName(event.target.value) }
                    maxLength={ 100 } />
            </Column>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.type') }</Text>
                <select
                    className="form-select form-select-sm"
                    value={ variableType }
                    onChange={ event => setVariableType(event.target.value) }>
                    { VARIABLE_TYPES.map(t => (
                        <option key={ t } value={ t }>{ t }</option>
                    )) }
                </select>
            </Column>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.default') }</Text>
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={ defaultValue }
                    onChange={ event => setDefaultValue(event.target.value) } />
            </Column>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.value') }</Text>
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={ valueToSet }
                    onChange={ event => setValueToSet(event.target.value) } />
            </Column>
            <Column gap={ 1 }>
                <div className="form-check">
                    <input
                        id="wired-give-var-persistent"
                        type="checkbox"
                        className="form-check-input"
                        checked={ isPersistent }
                        onChange={ event => setIsPersistent(event.target.checked) } />
                    <label htmlFor="wired-give-var-persistent" className="form-check-label">
                        <Text bold>{ LocalizeText('wiredfurni.params.user_variable.persistent') }</Text>
                    </label>
                </div>
            </Column>
        </WiredActionBaseView>
    );
}
