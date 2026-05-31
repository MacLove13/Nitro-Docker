import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { FurniCategory, GroupItem, LocalizeText } from '../../../../api';
import { Button, Flex } from '../../../../common';

export interface InventoryFurnitureSearchViewProps
{
    groupItems: GroupItem[];
    setGroupItems: Dispatch<SetStateAction<GroupItem[]>>;
}

const CATEGORY_ALL = 'all';
const CATEGORY_FLOOR = 'floor';
const CATEGORY_WALL = 'wall';
const CATEGORY_ROOMLAYOUT = 'roomlayout';

export const InventoryFurnitureSearchView: FC<InventoryFurnitureSearchViewProps> = props =>
{
    const { groupItems = [], setGroupItems = null } = props;
    const [ searchValue, setSearchValue ] = useState('');
    const [ categoryFilter, setCategoryFilter ] = useState(CATEGORY_ALL);

    useEffect(() =>
    {
        let filteredGroupItems = [ ...groupItems ];

        if(searchValue && searchValue.length)
        {
            const comparison = searchValue.toLocaleLowerCase();

            filteredGroupItems = filteredGroupItems.filter(item =>
            {
                if(comparison && comparison.length)
                {
                    if(item.name.toLocaleLowerCase().includes(comparison)) return item;
                }

                return null;
            });
        }

        if(categoryFilter !== CATEGORY_ALL)
        {
            filteredGroupItems = filteredGroupItems.filter(item =>
            {
                switch(categoryFilter)
                {
                    case CATEGORY_FLOOR:
                        return !item.isWallItem;
                    case CATEGORY_WALL:
                        return item.isWallItem;
                    case CATEGORY_ROOMLAYOUT:
                        return (item.category === FurniCategory.WALL_PAPER || item.category === FurniCategory.FLOOR || item.category === FurniCategory.LANDSCAPE);
                    default:
                        return true;
                }
            });
        }

        setGroupItems(filteredGroupItems);
    }, [ groupItems, setGroupItems, searchValue, categoryFilter ]);

    return (
        <Flex gap={ 1 } className="flex-column">
            <Flex gap={ 1 }>
                <input type="text" className="form-control form-control-sm" placeholder={ LocalizeText('generic.search') } value={ searchValue } onChange={ event => setSearchValue(event.target.value) } />
                <Button variant="primary">
                    <FaSearch className="fa-icon" />
                </Button>
            </Flex>
            <Flex gap={ 1 }>
                <select className="form-select form-select-sm" value={ categoryFilter } onChange={ event => setCategoryFilter(event.target.value) }>
                    <option value={ CATEGORY_ALL }>{ LocalizeText('inventory.furni.tab.all') }</option>
                    <option value={ CATEGORY_FLOOR }>{ LocalizeText('inventory.furni.tab.floor') }</option>
                    <option value={ CATEGORY_WALL }>{ LocalizeText('inventory.furni.tab.wall') }</option>
                    <option value={ CATEGORY_ROOMLAYOUT }>{ LocalizeText('inventory.furni.tab.roomlayout') }</option>
                </select>
                <select className="form-select form-select-sm">
                    <option value="all">{ LocalizeText('inventory.filter.option.everything') }</option>
                </select>
            </Flex>
        </Flex>
    );
}
