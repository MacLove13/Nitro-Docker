import { FC, useEffect, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { LocalizeBadgeDescription, LocalizeBadgeName, LocalizeText, UnseenItemCategory } from '../../../../api';
import { AutoGrid, Button, Column, Flex, Grid, LayoutBadgeImageView, Text } from '../../../../common';
import { useInventoryBadges, useInventoryUnseenTracker } from '../../../../hooks';
import { InventoryBadgeItemView } from './InventoryBadgeItemView';

export const InventoryBadgeView: FC<{}> = props =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ searchValue, setSearchValue ] = useState('');
    const { badgeCodes = [], activeBadgeCodes = [], selectedBadgeCode = null, isWearingBadge = null, canWearBadges = null, toggleBadge = null, getBadgeId = null, activate = null, deactivate = null } = useInventoryBadges();
    const { isUnseen = null, removeUnseen = null } = useInventoryUnseenTracker();

    const filteredBadgeCodes = badgeCodes.filter(code =>
    {
        if(isWearingBadge(code)) return false;

        if(searchValue && searchValue.length)
        {
            const name = LocalizeBadgeName(code).toLocaleLowerCase();
            if(!name.includes(searchValue.toLocaleLowerCase())) return false;
        }

        return true;
    });

    useEffect(() =>
    {
        if(!selectedBadgeCode || !isUnseen(UnseenItemCategory.BADGE, getBadgeId(selectedBadgeCode))) return;

        removeUnseen(UnseenItemCategory.BADGE, getBadgeId(selectedBadgeCode));
    }, [ selectedBadgeCode, isUnseen, removeUnseen, getBadgeId ]);

    useEffect(() =>
    {
        if(!isVisible) return;

        const id = activate();

        return () => deactivate(id);
    }, [ isVisible, activate, deactivate ]);

    useEffect(() =>
    {
        setIsVisible(true);

        return () => setIsVisible(false);
    }, []);

    return (
        <Grid>
            <Column size={ 7 } overflow="hidden">
                <Flex gap={ 1 }>
                    <input type="text" className="form-control form-control-sm" placeholder={ LocalizeText('generic.search') } value={ searchValue } onChange={ event => setSearchValue(event.target.value) } />
                    <Button variant="primary" className="px-2">
                        <FaSearch className="fa-icon" />
                    </Button>
                </Flex>
                <Flex gap={ 1 }>
                    <select className="form-select form-select-sm">
                        <option value="all">{ LocalizeText('inventory.filter.all') }</option>
                    </select>
                    <select className="form-select form-select-sm">
                        <option value="all">{ LocalizeText('inventory.filter.allrarities') }</option>
                    </select>
                </Flex>
                <AutoGrid columnCount={ 5 }>
                    { filteredBadgeCodes.map((badgeCode, index) => <InventoryBadgeItemView key={ index } badgeCode={ badgeCode } />) }
                </AutoGrid>
            </Column>
            <Column className="justify-content-between" size={ 5 } overflow="auto">
                <Column overflow="hidden" gap={ 2 }>
                    <Text bold>{ LocalizeText('inventory.badges.activebadges') }</Text>
                    <AutoGrid columnCount={ 3 }>
                        { activeBadgeCodes && (activeBadgeCodes.length > 0) && activeBadgeCodes.map((badgeCode, index) => <InventoryBadgeItemView key={ index } badgeCode={ badgeCode } />) }
                    </AutoGrid>
                </Column>
                { !!selectedBadgeCode &&
                    <Column grow justifyContent="end" gap={ 2 }>
                        <Flex alignItems="center" gap={ 2 }>
                            <LayoutBadgeImageView shrink badgeCode={ selectedBadgeCode } />
                            <Column gap={ 1 }>
                                <Text bold>{ LocalizeBadgeName(selectedBadgeCode) }</Text>
                                <Text small>{ LocalizeBadgeDescription(selectedBadgeCode) }</Text>
                                <span className="badge-rarity-tag">{ LocalizeText('inventory.badges.commonbadge') }</span>
                            </Column>
                        </Flex>
                        <Button variant={ (isWearingBadge(selectedBadgeCode) ? 'danger' : 'success') } disabled={ !isWearingBadge(selectedBadgeCode) && !canWearBadges() } onClick={ event => toggleBadge(selectedBadgeCode) }>{ LocalizeText(isWearingBadge(selectedBadgeCode) ? 'inventory.badges.clearbadge' : 'inventory.badges.wearbadge') }</Button>
                    </Column> }
            </Column>
        </Grid>
    );
}
