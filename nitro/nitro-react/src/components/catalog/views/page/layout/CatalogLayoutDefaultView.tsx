import { FC, useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { GetConfiguration, LocalizeText, ProductTypeEnum } from '../../../../../api';
import { Button, Column, Flex, LayoutImage, Text } from '../../../../../common';
import { useCatalog } from '../../../../../hooks';
import { CatalogAddOnBadgeWidgetView } from '../widgets/CatalogAddOnBadgeWidgetView';
import { CatalogItemGridWidgetView } from '../widgets/CatalogItemGridWidgetView';
import { CatalogLimitedItemWidgetView } from '../widgets/CatalogLimitedItemWidgetView';
import { CatalogPriceDisplayWidgetView } from '../widgets/CatalogPriceDisplayWidgetView';
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
    const { currentOffer = null, currentPage = null, purchaseOptions = null, setPurchaseOptions = null, setCurrentOffer = null } = useCatalog();
    const [ showCrackablePrizes, setShowCrackablePrizes ] = useState(false);

    const offers = currentPage?.offers ?? [];
    const currentOfferIndex = currentOffer ? offers.findIndex(o => o.offerId === currentOffer.offerId) : -1;

    const selectOfferAtIndex = (index: number) =>
    {
        const offer = offers[index];
        if(!offer) return;
        offer.activate();
        setCurrentOffer(offer);
    }

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

                { /* Item name bar with prev/next arrows */ }
                <Flex alignItems="center" justifyContent="between" className="nitro-catalog-item-name-bar">
                    <Text className="nitro-catalog-item-name">
                        { currentOffer ? currentOffer.localizationName : (page.localization.getText(0) || '') }
                    </Text>
                    <Flex gap={ 1 } className="nitro-catalog-item-nav-arrows" alignItems="center">
                        <button
                            className="nitro-catalog-item-nav-btn"
                            disabled={ !currentOffer || currentOfferIndex <= 0 }
                            onClick={ () => selectOfferAtIndex(currentOfferIndex - 1) }>
                            <FaChevronLeft className="fa-icon" />
                        </button>
                        <button
                            className="nitro-catalog-item-nav-btn"
                            disabled={ !currentOffer || currentOfferIndex < 0 || currentOfferIndex >= offers.length - 1 }
                            onClick={ () => selectOfferAtIndex(currentOfferIndex + 1) }>
                            <FaChevronRight className="fa-icon" />
                        </button>
                    </Flex>
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
                    { currentOffer &&
                        <Flex alignItems="center" gap={ 1 } className="nitro-catalog-price-badge" position="absolute">
                            <CatalogPriceDisplayWidgetView offer={ currentOffer } separator={ true } />
                        </Flex> }
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
                    { !currentOffer ? (
                        <Flex grow center>
                            <Button className="nitro-catalog-choose-btn" disabled>
                                { LocalizeText('catalog.footer.choose_item') }
                            </Button>
                        </Flex>
                    ) : (
                        <>
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
                                <Text className="nitro-catalog-bar-label">{ LocalizeText('catalog.price') }</Text>
                                <CatalogTotalPriceWidget alignItems="center" />
                            </Flex>

                            { /* Crackable prizes */ }
                            <CrackableButton
                                spriteId={ currentOffer.product.productClassId }
                                onShow={ () => setShowCrackablePrizes(true) }
                            />

                            { /* Buy as gift + Buy */ }
                            <CatalogPurchaseWidgetView />
                        </>
                    ) }
                </Flex>

            </Column>
        </>
    );
}
