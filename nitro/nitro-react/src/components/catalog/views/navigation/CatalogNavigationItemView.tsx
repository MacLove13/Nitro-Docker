import { FC } from 'react';
import { FaCaretDown, FaCaretUp } from 'react-icons/fa';
import { ICatalogNode } from '../../../../api';
import { Base, LayoutGridItem, Text } from '../../../../common';
import { useCatalog } from '../../../../hooks';
import { CatalogIconView } from '../catalog-icon/CatalogIconView';
import { CatalogNavigationSetView } from './CatalogNavigationSetView';

export interface CatalogNavigationItemViewProps
{
    node: ICatalogNode;
    child?: boolean;
}

export const CatalogNavigationItemView: FC<CatalogNavigationItemViewProps> = props =>
{
    const { node = null, child = false } = props;
    const { activateNode = null } = useCatalog();
    const classNames = [ 'nitro-catalog-navigation-item' ];

    if(child) classNames.push('is-child');
    if(node.isBranch) classNames.push('is-branch');
    if(node.isActive) classNames.push('is-active');
    
    return (
        <Base className="nitro-catalog-navigation-section">
            <LayoutGridItem gap={ 1 } column={ false } itemActive={ node.isActive } onClick={ event => activateNode(node) } classNames={ classNames }>
                <Base className="nitro-catalog-navigation-item-icon">
                    <CatalogIconView icon={ node.iconId } />
                </Base>
                <Text grow truncate className="nitro-catalog-navigation-item-label">{ node.localization }</Text>
                { node.isBranch &&
                    <Base className="nitro-catalog-navigation-item-arrow">
                        { node.isOpen && <FaCaretUp className="fa-icon" /> }
                        { !node.isOpen && <FaCaretDown className="fa-icon" /> }
                    </Base> }
            </LayoutGridItem>
            { node.isOpen && node.isBranch &&
                <CatalogNavigationSetView node={ node } child={ true } /> }
        </Base>
    );
}
