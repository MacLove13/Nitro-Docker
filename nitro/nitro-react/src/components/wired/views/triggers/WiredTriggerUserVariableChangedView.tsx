import { FC, useEffect, useState } from 'react';
import { LocalizeText, WiredFurniType } from '../../../../api';
import { Column, Text } from '../../../../common';
import { useWired } from '../../../../hooks';
import { WiredTriggerBaseView } from './WiredTriggerBaseView';

export const WiredTriggerUserVariableChangedView: FC<{}> = props =>
{
    const [ variableName, setVariableName ] = useState('');
    const [ availableVariables, setAvailableVariables ] = useState<string[]>([]);
    const { trigger = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setStringParam(variableName + '\t');
    };

    useEffect(() =>
    {
        if(!trigger || !trigger.stringData) return;

        const parts = trigger.stringData.split('\t');
        const name = parts[0] ?? '';
        const varList = parts[1] ?? '';
        const vars = varList ? varList.split(',').filter(v => v.length > 0) : [];
        const initialName = name !== '' ? name : (vars.length > 0 ? vars[0] : '');

        setAvailableVariables(vars);
        setVariableName(initialName);
    }, [ trigger ]);

    return (
        <WiredTriggerBaseView requiresFurni={ WiredFurniType.STUFF_SELECTION_OPTION_NONE } hasSpecialInput={ true } save={ save }>
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
        </WiredTriggerBaseView>
    );
}
