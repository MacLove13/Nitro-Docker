import { ILinkEventTracker, RemoveFriendComposer, SendRoomInviteComposer } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FaCaretDown, FaCaretRight, FaSearch, FaTrash } from 'react-icons/fa';
import { AddEventLinkTracker, LocalizeText, MessengerFriend, RemoveLinkEventTracker, SendMessageComposer } from '../../../../api';
import { Base, Flex, NitroCardAccordionSetView, NitroCardAccordionView, NitroCardContentView, NitroCardHeaderView, NitroCardView, Text } from '../../../../common';
import { useFriends } from '../../../../hooks';
import { FriendsListGroupView } from './friends-list-group/FriendsListGroupView';
import { FriendsListRequestView } from './friends-list-request/FriendsListRequestView';
import { FriendsRemoveConfirmationView } from './FriendsListRemoveConfirmationView';
import { FriendsRoomInviteView } from './FriendsListRoomInviteView';
import { FriendsSearchView } from './FriendsListSearchView';

export const FriendsListView: FC<{}> = props =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ activeTab, setActiveTab ] = useState<'friends' | 'search'>('friends');
    const [ selectedFriendsIds, setSelectedFriendsIds ] = useState<number[]>([]);
    const [ showRoomInvite, setShowRoomInvite ] = useState<boolean>(false);
    const [ showRemoveFriendsConfirmation, setShowRemoveFriendsConfirmation ] = useState<boolean>(false);
    const { onlineFriends = [], offlineFriends = [], requests = [], requestFriend = null, followFriend = null } = useFriends();

    const removeFriendsText = useMemo(() =>
    {
        if(!selectedFriendsIds || !selectedFriendsIds.length) return '';

        const userNames: string[] = [];

        for(const userId of selectedFriendsIds)
        {
            let existingFriend: MessengerFriend = onlineFriends.find(f => f.id === userId);

            if(!existingFriend) existingFriend = offlineFriends.find(f => f.id === userId);

            if(!existingFriend) continue;

            userNames.push(existingFriend.name);
        }

        return LocalizeText('friendlist.removefriendconfirm.userlist', [ 'user_names' ], [ userNames.join(', ') ]);
    }, [ offlineFriends, onlineFriends, selectedFriendsIds ]);

    const selectFriend = useCallback((userId: number) =>
    {
        if(userId < 0) return;

        setSelectedFriendsIds(prevValue =>
        {
            const newValue = [ ...prevValue ];

            const existingUserIdIndex: number = newValue.indexOf(userId);

            if(existingUserIdIndex > -1)
            {
                newValue.splice(existingUserIdIndex, 1)
            }
            else
            {
                newValue.push(userId);
            }

            return newValue;
        });
    }, [ setSelectedFriendsIds ]);

    const selectAllFriends = useCallback(() =>
    {
        setSelectedFriendsIds(onlineFriends.map(f => f.id));
    }, [ onlineFriends ]);

    const sendRoomInvite = (message: string) =>
    {
        if(!selectedFriendsIds.length || !message || !message.length || (message.length > 255)) return;
        
        SendMessageComposer(new SendRoomInviteComposer(message, selectedFriendsIds));

        setShowRoomInvite(false);
    }

    const removeSelectedFriends = () =>
    {
        if(selectedFriendsIds.length === 0) return;

        setSelectedFriendsIds(prevValue =>
        {
            SendMessageComposer(new RemoveFriendComposer(...prevValue));

            return [];
        });

        setShowRemoveFriendsConfirmation(false);
    }

    const followFirstSelected = useCallback(() =>
    {
        if(!selectedFriendsIds.length || !followFriend) return;

        const firstId = selectedFriendsIds[0];
        const friend = onlineFriends.find(f => f.id === firstId) || offlineFriends.find(f => f.id === firstId);

        if(friend) followFriend(friend);
    }, [ selectedFriendsIds, onlineFriends, offlineFriends, followFriend ]);

    useEffect(() =>
    {
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');

                if(parts.length < 2) return;
        
                switch(parts[1])
                {
                    case 'show':
                        setIsVisible(true);
                        return;
                    case 'hide':
                        setIsVisible(false);
                        return;
                    case 'toggle':
                        setIsVisible(prevValue => !prevValue);
                        return;
                    case 'request':
                        if(parts.length < 4) return;

                        requestFriend(parseInt(parts[2]), parts[3]);
                }
            },
            eventUrlPrefix: 'friends/'
        };

        AddEventLinkTracker(linkTracker);

        return () => RemoveLinkEventTracker(linkTracker);
    }, [ requestFriend ]);

    if(!isVisible) return null;

    const hasSelection = selectedFriendsIds.length > 0;

    const selectAllButton = onlineFriends.length > 0 ? (
        <Text small pointer className="nitro-friends-select-all" onClick={ selectAllFriends }>
            { LocalizeText('friendlist.select.all') }
        </Text>
    ) : null;

    return (
        <>
            <NitroCardView className="nitro-friends" uniqueKey="nitro-friends" theme="primary-slim">
                <NitroCardHeaderView headerText={ LocalizeText('friendlist.friends') } onCloseClick={ event => setIsVisible(false) } />
                <NitroCardContentView overflow="hidden" gap={ 0 } className="text-black p-0">
                    { activeTab === 'friends' &&
                        <>
                            <Flex pointer justifyContent="between" alignItems="center" className="nitro-card-accordion-set-header px-2 py-1">
                                <Text>{ LocalizeText('friendlist.friends') }</Text>
                                <FaCaretDown className="fa-icon" />
                            </Flex>
                            <NitroCardAccordionView grow overflow="hidden" style={ { minHeight: 0 } }>
                                <NitroCardAccordionSetView
                                    headerText={ `${ LocalizeText('friendlist.friends') } (${ onlineFriends.length })` }
                                    isExpanded={ true }
                                    headerRightContent={ selectAllButton }
                                >
                                    <FriendsListGroupView list={ onlineFriends } selectedFriendsIds={ selectedFriendsIds } selectFriend={ selectFriend } />
                                </NitroCardAccordionSetView>
                                <NitroCardAccordionSetView headerText={ `${ LocalizeText('friendlist.friends.offlinecaption') } (${ offlineFriends.length })` }>
                                    <FriendsListGroupView list={ offlineFriends } selectedFriendsIds={ selectedFriendsIds } selectFriend={ selectFriend } />
                                </NitroCardAccordionSetView>
                                <FriendsListRequestView headerText={ LocalizeText('friendlist.tab.friendrequests') + ` (${ requests.length })` } isExpanded={ true } />
                            </NitroCardAccordionView>
                            <Flex justifyContent="between" alignItems="center" className="nitro-friends-toolbar px-2 py-1">
                                <Flex gap={ 2 } alignItems="center">
                                    <Base pointer={ hasSelection } className={ `nitro-friends-spritesheet icon-friendbar-chat${ !hasSelection ? ' nitro-friends-toolbar-btn-disabled' : '' }` } onClick={ hasSelection ? () => setShowRoomInvite(true) : null } title={ LocalizeText('friendlist.tip.invite') } />
                                    <Base pointer={ hasSelection } className={ `nitro-friends-spritesheet icon-follow${ !hasSelection ? ' nitro-friends-toolbar-btn-disabled' : '' }` } onClick={ hasSelection ? followFirstSelected : null } title={ LocalizeText('friendlist.tip.follow') } />
                                </Flex>
                                <Flex gap={ 2 } alignItems="center">
                                    <FaSearch className="cursor-pointer fa-icon" onClick={ () => setActiveTab('search') } title={ LocalizeText('people.search.title') } />
                                    <FaTrash className={ `fa-icon${ !hasSelection ? ' nitro-friends-toolbar-btn-disabled' : ' cursor-pointer' }` } onClick={ hasSelection ? () => setShowRemoveFriendsConfirmation(true) : null } title={ LocalizeText('generic.delete') } />
                                </Flex>
                            </Flex>
                            <Flex pointer justifyContent="between" alignItems="center" className="nitro-card-accordion-set-header px-2 py-1" onClick={ () => setActiveTab('search') }>
                                <Text>{ LocalizeText('people.search.title') }</Text>
                                <FaCaretRight className="fa-icon" />
                            </Flex>
                        </> }
                    { activeTab === 'search' &&
                        <>
                            <Flex pointer justifyContent="between" alignItems="center" className="nitro-card-accordion-set-header px-2 py-1" onClick={ () => setActiveTab('friends') }>
                                <Text>{ LocalizeText('friendlist.friends') }</Text>
                                <FaCaretRight className="fa-icon" />
                            </Flex>
                            <Flex pointer justifyContent="between" alignItems="center" className="nitro-card-accordion-set-header px-2 py-1">
                                <Text>{ LocalizeText('people.search.title') }</Text>
                                <FaCaretDown className="fa-icon" />
                            </Flex>
                            <FriendsSearchView />
                        </> }
                </NitroCardContentView>
            </NitroCardView>
            { showRoomInvite &&
                <FriendsRoomInviteView selectedFriendsIds={ selectedFriendsIds } onCloseClick={ () => setShowRoomInvite(false) } sendRoomInvite={ sendRoomInvite } /> }
            { showRemoveFriendsConfirmation && 
                <FriendsRemoveConfirmationView selectedFriendsIds={ selectedFriendsIds } removeFriendsText={ removeFriendsText } onCloseClick={ () => setShowRemoveFriendsConfirmation(false) } removeSelectedFriends={ removeSelectedFriends } /> }
        </>
    );
};
