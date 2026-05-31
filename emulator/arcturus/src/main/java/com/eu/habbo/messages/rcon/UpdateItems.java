package com.eu.habbo.messages.rcon;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.messages.outgoing.rooms.RoomRelativeMapComposer;
import com.google.gson.Gson;

/**
 * RCON command: updateitems
 *
 * Reloads items_base and soundtracks from the database, then refreshes
 * the relative height-map in all active rooms so clients see the changes.
 * Rooms with no active users are cleared from the cache so they are
 * reloaded fresh (with new interaction types) on next entry.
 */
public class UpdateItems extends RCONMessage<UpdateItems.JSONUpdateItems> {

    public UpdateItems() {
        super(JSONUpdateItems.class);
    }

    @Override
    public void handle(Gson gson, JSONUpdateItems json) {
        // Reload base item definitions (interaction_type, dimensions, etc.)
        Emulator.getGameEnvironment().getItemManager().loadItems();
        Emulator.getGameEnvironment().getItemManager().loadCrackable();
        Emulator.getGameEnvironment().getItemManager().loadSoundTracks();

        // Refresh layout / height-map in active rooms so clients update visually
        synchronized (Emulator.getGameEnvironment().getRoomManager().getActiveRooms()) {
            for (Room room : Emulator.getGameEnvironment().getRoomManager().getActiveRooms()) {
                if (room.isLoaded() && room.getUserCount() > 0 && room.getLayout() != null) {
                    room.sendComposer(new RoomRelativeMapComposer(room).compose());
                }
            }
        }

        // Evict empty rooms so they are reconstructed with the new item classes on next load
        Emulator.getGameEnvironment().getRoomManager().clearInactiveRooms();
    }

    static class JSONUpdateItems {
    }
}
