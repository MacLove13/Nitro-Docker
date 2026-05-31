import { FC, useEffect, useState } from 'react';
import { GetConfiguration, LocalizeText, ProductTypeEnum } from '../../../../../api';
import { Button, Column, Flex, LayoutImage, Text } from '../../../../../common';
import { useCatalog } from '../../../../../hooks';
import { CatalogHeaderView } from '../../catalog-header/CatalogHeaderView';
import { CatalogAddOnBadgeWidgetView } from '../widgets/CatalogAddOnBadgeWidgetView';
import { CatalogItemGridWidgetView } from '../widgets/CatalogItemGridWidgetView';
import { CatalogLimitedItemWidgetView } from '../widgets/CatalogLimitedItemWidgetView';
import { CatalogPurchaseWidgetView } from '../widgets/CatalogPurchaseWidgetView';
import { CatalogTotalPriceWidget } from '../widgets/CatalogTotalPriceWidget';
import { CatalogViewProductWidgetView } from '../widgets/CatalogViewProductWidgetView';
import { CatalogCrackablePrizesView } from './CatalogCrackablePrizesView';
import { CatalogLayoutProps } from './CatalogLayout.types';

// Inner component: checks CMS API if this sprite has crackable prizes
const CrackableButton: FC<{ spriteId: number; onShow: () => void }> = ({ spriteId, onShow }) =>
{
    const [ hasPrizes, setHasPrizes ] = useState(false);

    useEffect(() =>
    {
        setHasPrizes(false);
        if(!spriteId) return;

        const cmsUrl = GetConfiguration<string>('cms.url', '');
        if(!cmsUrl) return;

        fetch(`${ cmsUrl }/api/public/catalog/crackable?item_id=${ spriteId }`)
            .then(r => r.json())
            .then(data => setHasPrizes(Array.isArray(data?.prizes) && data.prizes.length > 0))
            .catch(() => setHasPrizes(false));
    }, [ spriteId ]);

    if(!hasPrizes) return null;

    return (
        <Button variant="secondary" onClick={ onShow }>
            🎲 Ver probabilidades
        </Button>
    );
}

export const CatalogLayoutDefaultView: FC<CatalogLayoutProps> = props =>
{
    const { page = null } = props;
    const { currentOffer = null, currentPage = null, purchaseOptions = null, setPurchaseOptions = null } = useCatalog();
    const [ showCrackablePrizes, setShowCrackablePrizes ] = useState(false);

    const updateQuantity = (value: number) =>
    {
        if(isNaN(value)) value = 1;
        value = Math.max(1, Math.min(100, value));
        setPurchaseOptions(prevValue => ({ ...prevValue, quantity: value }));
    }

    return (
        <>
            { showCrackablePrizes && currentOffer &&
                <CatalogCrackablePrizesView
                    spriteId={ currentOffer.product.productClassId }
                    itemName={ currentOffer.localizationName }
                    onClose={ () => setShowCrackablePrizes(false) }
                /> }
            <Column fullHeight className="nitro-catalog-default-page" gap={ 0 } overflow="hidden">

                { /* Header image (teal banner) */ }
                { GetConfiguration('catalog.headers') &&
                    <CatalogHeaderView imageUrl={ currentPage.localization.getImage(0) } /> }

                { /* Item name bar */ }
                <Flex alignItems="center" className="nitro-catalog-item-name-bar">
                    <Text className="nitro-catalog-item-name">
                        { currentOffer ? currentOffer.localizationName : (page.localization.getText(0) || '') }
                    </Text>
                </Flex>

                { /* Room previewer */ }
                <Flex center className="nitro-catalog-previewer" position="relative">
                    { currentOffer && (currentOffer.product.productType !== ProductTypeEnum.BADGE) &&
                        <>
                            <CatalogViewProductWidgetView />
                            <CatalogAddOnBadgeWidgetView className="position-absolute bottom-1 end-1" />
                        </> }
                    { currentOffer && (currentOffer.product.productType === ProductTypeEnum.BADGE) &&
                        <CatalogAddOnBadgeWidgetView className="scale-2" /> }
                    { !currentOffer && !!page.localization.getImage(1) &&
                        <LayoutImage imageUrl={ page.localization.getImage(1) } /> }
                    <CatalogLimitedItemWidgetView fullWidth />
                </Flex>

                { /* Item grid with price labels */ }
                <Column className="nitro-catalog-item-grid-wrap" overflow="hidden">
                    <CatalogItemGridWidgetView
                        className="nitro-catalog-item-grid"
                        columnCount={ 6 }
                        showPriceLabels
                    />
                </Column>

                { /* Bottom purchase bar */ }
                <Flex className="nitro-catalog-bottom-bar" alignItems="center" gap={ 2 }>
                    { /* Quantity */ }
                    <Flex alignItems="center" gap={ 1 }>
                        <Text className="nitro-catalog-bar-label">
                            { LocalizeText('catalog.bundlewidget.quantity') }
                        </Text>
                        <input
                            type="number"
                            className="nitro-catalog-qty-input"
                            min={ 1 }
                            max={ 100 }
                            value={ purchaseOptions?.quantity ?? 1 }
                            onChange={ e => updateQuantity(e.target.valueAsNumber) }
                        />
                    </Flex>

                    { /* Price (grows to push buttons right) */ }
                    <Flex grow justifyContent="end" alignItems="center" gap={ 1 }>
                        { currentOffer &&
                            <>
                                <Text className="nitro-catalog-bar-label">{ LocalizeText('catalog.price') }</Text>
                                <CatalogTotalPriceWidget alignItems="center" />
                            </> }
                    </Flex>

                    { /* Crackable prizes */ }
                    { currentOffer &&
                        <CrackableButton
                            spriteId={ currentOffer.product.productClassId }
                            onShow={ () => setShowCrackablePrizes(true) }
                        /> }

                    { /* Buy as gift + Buy */ }
                    <CatalogPurchaseWidgetView />
                </Flex>

            </Column>
        </>
    );
}
