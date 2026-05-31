import { FC, useEffect, useState } from 'react';
import { LocalizeText, WiredFurniType } from '../../../../api';
import { Column, Text } from '../../../../common';
import { useWired } from '../../../../hooks';
import { WiredActionBaseView } from './WiredActionBaseView';

export const WiredActionGiveUserVariableView: FC<{}> = props =>
{
    const [ variableName, setVariableName ] = useState('');
    const [ valueToSet, setValueToSet ] = useState('0');
    const [ availableVariables, setAvailableVariables ] = useState<string[]>([]);
    const { trigger = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setStringParam([ variableName, valueToSet ].join('\t'));
    };

    useEffect(() =>
    {
        if(!trigger || !trigger.stringData) return;

        const parts = trigger.stringData.split('\t');
        if(parts.length >= 2)
        {
            setVariableName(parts[0] ?? '');
            setValueToSet(parts[1] ?? '0');
            const varList = parts[2] ?? '';
            const vars = varList ? varList.split(',').filter(v => v.length > 0) : [];
            setAvailableVariables(vars);
            if(parts[0] === '' && vars.length > 0) setVariableName(vars[0]);
        }
    }, [ trigger ]);

    return (
        <WiredActionBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.name') }</Text>
                { availableVariables.length > 0 ? (
                    <select
                        className="form-select form-select-sm"
                        value={ variableName }
                        onChange={ event => setVariableName(event.target.value) }>
                        { availableVariables.map(v => (
                            <option key={ v } value={ v }>{ v }</option>
                        )) }
                    </select>
                ) : (
                    <Text small>{ LocalizeText('wiredfurni.params.user_variable.no_variables') }</Text>
                ) }
            </Column>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.value') }</Text>
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={ valueToSet }
                    onChange={ event => setValueToSet(event.target.value) } />
            </Column>
        </WiredActionBaseView>
    );
}
