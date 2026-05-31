import { FC, useEffect, useState } from 'react';
import { LocalizeText, WiredFurniType } from '../../../../api';
import { Column, Text } from '../../../../common';
import { useWired } from '../../../../hooks';
import { WiredActionBaseView } from './WiredActionBaseView';

const VARIABLE_TYPES = ['number', 'text', 'boolean', 'user'];
const OPERATIONS_NUMBER = ['+', '-', '*', '/', '='];
const OPERATIONS_TEXT = ['=', 'concat'];
const OPERATIONS_BOOLEAN = ['='];
const OPERATIONS_USER = ['='];

const getOperationsForType = (vType: string): string[] =>
{
    switch(vType)
    {
        case 'number': return OPERATIONS_NUMBER;
        case 'text': return OPERATIONS_TEXT;
        case 'boolean': return OPERATIONS_BOOLEAN;
        case 'user': return OPERATIONS_USER;
        default: return OPERATIONS_NUMBER;
    }
};

export const WiredActionChangeUserVariableView: FC<{}> = props =>
{
    const [ variableName, setVariableName ] = useState('');
    const [ variableType, setVariableType ] = useState('number');
    const [ defaultValue, setDefaultValue ] = useState('0');
    const [ isPersistent, setIsPersistent ] = useState(false);
    const [ operation, setOperation ] = useState('=');
    const [ operationValue, setOperationValue ] = useState('0');
    const { trigger = null, setStringParam = null } = useWired();

    const availableOps = getOperationsForType(variableType);

    const handleTypeChange = (newType: string) =>
    {
        setVariableType(newType);
        const ops = getOperationsForType(newType);
        if(!ops.includes(operation)) setOperation(ops[0]);
    };

    const save = () =>
    {
        setStringParam([ variableName, variableType, defaultValue, String(isPersistent), operation, operationValue ].join('\t'));
    };

    useEffect(() =>
    {
        if(!trigger || !trigger.stringData) return;

        const parts = trigger.stringData.split('\t');
        if(parts.length >= 6)
        {
            const loadedType = parts[1] ?? 'number';
            setVariableName(parts[0] ?? '');
            setVariableType(loadedType);
            setDefaultValue(parts[2] ?? '0');
            setIsPersistent(parts[3] === 'true');
            setOperation(parts[4] ?? '=');
            setOperationValue(parts[5] ?? '0');
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
                    onChange={ event => handleTypeChange(event.target.value) }>
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
                <Text bold>{ LocalizeText('wiredfurni.params.user_variable.operation') }</Text>
                <select
                    className="form-select form-select-sm"
                    value={ operation }
                    onChange={ event => setOperation(event.target.value) }>
                    { availableOps.map(op => (
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
            <Column gap={ 1 }>
                <div className="form-check">
                    <input
                        id="wired-change-var-persistent"
                        type="checkbox"
                        className="form-check-input"
                        checked={ isPersistent }
                        onChange={ event => setIsPersistent(event.target.checked) } />
                    <label htmlFor="wired-change-var-persistent" className="form-check-label">
                        <Text bold>{ LocalizeText('wiredfurni.params.user_variable.persistent') }</Text>
                    </label>
                </div>
            </Column>
        </WiredActionBaseView>
    );
}
