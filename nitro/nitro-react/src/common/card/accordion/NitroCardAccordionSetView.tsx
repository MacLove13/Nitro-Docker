import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { FaCaretDown, FaCaretRight } from 'react-icons/fa';
import { Column, ColumnProps, Flex, Text } from '../..';
import { useNitroCardAccordionContext } from './NitroCardAccordionContext';

export interface NitroCardAccordionSetViewProps extends ColumnProps
{
    headerText: string;
    isExpanded?: boolean;
    headerRightContent?: ReactNode;
}

export const NitroCardAccordionSetView: FC<NitroCardAccordionSetViewProps> = props =>
{
    const { headerText = '', isExpanded = false, headerRightContent = null, gap = 0, classNames = [], children = null, ...rest } = props;
    const [ isOpen, setIsOpen ] = useState(false);
    const { setClosers = null, closeAll = null } = useNitroCardAccordionContext();

    const onClick = () =>
    {
        closeAll();
        
        setIsOpen(prevValue => !prevValue);
    }

    const onClose = useCallback(() => setIsOpen(false), []);

    const getClassNames = useMemo(() =>
    {
        const newClassNames = [ 'nitro-card-accordion-set' ];

        if(isOpen) newClassNames.push('active');

        if(classNames && classNames.length) newClassNames.push(...classNames);

        return newClassNames;
    }, [ isOpen, classNames ]);

    useEffect(() =>
    {
        setIsOpen(isExpanded);
    }, [ isExpanded ]);

    useEffect(() =>
    {
        const closeFunction = onClose;

        setClosers(prevValue =>
        {
            const newClosers = [ ...prevValue ];

            newClosers.push(closeFunction);

            return newClosers;
        });

        return () =>
        {
            setClosers(prevValue =>
            {
                const newClosers = [ ...prevValue ];

                const index = newClosers.indexOf(closeFunction);

                if(index >= 0) newClosers.splice(index, 1);
    
                return newClosers;
            });
        }
    }, [ onClose, setClosers ]);

    return (
        <Column classNames={ getClassNames } gap={ gap } { ...rest }>
            <Flex pointer justifyContent="between" alignItems="center" className="nitro-card-accordion-set-header px-2 py-1" onClick={ onClick }>
                <Text>{ headerText }</Text>
                <Flex alignItems="center" gap={ 1 }>
                    { isOpen && headerRightContent && <span onClick={ e => e.stopPropagation() }>{ headerRightContent }</span> }
                    { isOpen ? <FaCaretDown className="fa-icon" /> : <FaCaretRight className="fa-icon" /> }
                </Flex>
            </Flex>
            { isOpen &&
                <Column fullHeight overflow="auto" gap={ 0 } className="nitro-card-accordion-set-content">
                    { children }
                </Column> }
        </Column>
    );
}
