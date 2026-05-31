import { FC, useEffect, useState } from 'react';
import { GetConfiguration, GetRoomEngine, ProductTypeEnum } from '../../../../../api';
import { Button, Column, Flex, Grid, NitroCardContentView, NitroCardHeaderView, NitroCardView, Text } from '../../../../../common';
import { LayoutFurniImageView } from '../../../../../common';

interface CrackablePrize
{
    item_id: number;
    sprite_id: number;
    item_name: string;
    item_type: string;
    weight: number;
    percentage: number;
}

interface CatalogCrackablePrizesViewProps
{
    spriteId: number;
    itemName: string;
    onClose: () => void;
}

export const CatalogCrackablePrizesView: FC<CatalogCrackablePrizesViewProps> = props =>
{
    const { spriteId, itemName, onClose } = props;
    const [ prizes, setPrizes ] = useState<CrackablePrize[]>(null);
    const [ loading, setLoading ] = useState(true);

    useEffect(() =>
    {
        if(!spriteId) return;

        setLoading(true);
        setPrizes(null);

        const cmsUrl = (GetConfiguration<string>('cms.url', '') || '').replace(/\/$/, '');
        const apiUrl = cmsUrl ? `${ cmsUrl }/api/public/catalog/crackable?item_id=${ spriteId }` : `/api/public/catalog/crackable?item_id=${ spriteId }`;
        fetch(apiUrl)
            .then(r => r.json())
            .then(data => setPrizes(data?.prizes ?? []))
            .catch(() => setPrizes([]))
            .finally(() => setLoading(false));
    }, [ spriteId ]);

    return (
        <NitroCardView className="nitro-catalog-crackable-prizes" theme="primary-slim" style={ { width: 420, zIndex: 9999 } }>
            <NitroCardHeaderView headerText={ `Probabilidades: ${ itemName }` } onCloseClick={ onClose } />
            <NitroCardContentView overflow="auto">
                { loading && <Flex center fullWidth><Text>Carregando...</Text></Flex> }
                { !loading && (!prizes || prizes.length === 0) &&
                    <Flex center fullWidth><Text>Nenhum prêmio encontrado.</Text></Flex> }
                { !loading && prizes && prizes.length > 0 &&
                    <Grid columnCount={ 2 } gap={ 2 }>
                        { prizes.map((prize, index) =>
                            <Flex key={ index } alignItems="center" gap={ 2 } className="rounded border p-1" style={ { background: 'rgba(0,0,0,0.15)' } }>
                                <Flex center style={ { width: 64, height: 64, minWidth: 64, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', borderRadius: 4 } }>
                                    <LayoutFurniImageView
                                        productType={ prize.item_type === 'i' ? ProductTypeEnum.WALL : ProductTypeEnum.FLOOR }
                                        productClassId={ prize.sprite_id }
                                        direction={ 2 }
                                        scale={ 1 }
                                    />
                                </Flex>
                                <Column gap={ 0 } grow>
                                    <Text small truncate title={ prize.item_name }>{ prize.item_name }</Text>
                                    <Flex alignItems="center" gap={ 1 }>
                                        <div style={ { flex: 1, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' } }>
                                            <div style={ { width: `${ Math.min(prize.percentage, 100) }%`, height: '100%', background: '#5cb85c', borderRadius: 3 } } />
                                        </div>
                                        <Text bold style={ { minWidth: 48, textAlign: 'right', color: '#5cb85c' } }>{ prize.percentage }%</Text>
                                    </Flex>
                                </Column>
                            </Flex>
                        ) }
                    </Grid> }
            </NitroCardContentView>
        </NitroCardView>
    );
}
