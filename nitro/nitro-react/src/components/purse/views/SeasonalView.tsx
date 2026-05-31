import { FC } from 'react';
import { CreateLinkEvent, LocalizeText } from '../../../api';
import { Flex, LayoutCurrencyIcon, Text } from '../../../common';

interface SeasonalViewProps
{
    type: number;
    amount: number;
}

export const SeasonalView: FC<SeasonalViewProps> = props =>
{
    const { type = -1, amount = -1 } = props;

    return (
        <Flex fullWidth alignItems="center" justifyContent="between" className="nitro-purse-seasonal-currency p-2 rounded">
            <Text variant="white">{ LocalizeText(`purse.seasonal.currency.${ type }`) }</Text>
            <Flex gap={ 1 } alignItems="center">
                <Flex center pointer className="nitro-purse-button nitro-purse-seasonal-info px-1 rounded" onClick={ () => CreateLinkEvent('habboUI/open/seasonal') }>
                    <Text small variant="white">{ LocalizeText('purse.shells.zero.amount.text') }</Text>
                </Flex>
                <LayoutCurrencyIcon type={ type } />
            </Flex>
        </Flex>
    );
}
