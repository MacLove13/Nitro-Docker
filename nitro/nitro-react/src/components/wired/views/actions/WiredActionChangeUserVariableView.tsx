import { FC, useEffect, useState } from 'react';
import { LocalizeText, WiredFurniType } from '../../../../api';
import { Column, Text } from '../../../../common';
import { useWired } from '../../../../hooks';
import { WiredActionBaseView } from './WiredActionBaseView';

const ALL_OPERATIONS = ['+', '-', '*', '/', '=', 'concat'];

export const WiredActionChangeUserVariableView: FC<{}> = props =>
{
    const [ variableName, setVariableName ] = useState('');
    const [ operation, setOperation ] = useState('=');
    const [ operationValue, setOperationValue ] = useState('0');
    const [ availableVariables, setAvailableVariables ] = useState<string[]>([]);
    const { trigger = null, setStringParam = null } = useWired();

    const save = () =>
    {
        setStringParam([ variableName, operation, operationValue ].join('\t'));
    };

    useEffect(() =>
    {
        if(!trigger || !trigger.stringData) return;

        const parts = trigger.stringData.split('\t');
        if(parts.length >= 3)
        {
            setVariableName(parts[0] ?? '');
            setOperation(parts[1] ?? '=');
            setOperationValue(parts[2] ?? '0');
            const varList = parts[3] ?? '';
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
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.operation') }</Text>
                <select
                    className="form-select form-select-sm"
                    value={ operation }
                    onChange={ event => setOperation(event.target.value) }>
                    { ALL_OPERATIONS.map(op => (
                        <option key={ op } value={ op }>{ op }</option>
                    )) }
                </select>
            </Column>
            <Column gap={ 1 }>
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.op_value') }</Text>
                <input
                    type="text"
                    className="form-control form-control-sm"
                    value={ operationValue }
                    onChange={ event => setOperationValue(event.target.value) } />
            </Column>
        </WiredActionBaseView>
    );
}
