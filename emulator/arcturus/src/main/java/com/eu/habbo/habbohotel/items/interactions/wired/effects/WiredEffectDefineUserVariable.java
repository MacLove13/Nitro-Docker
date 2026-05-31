package com.eu.habbo.habbohotel.items.interactions.wired.effects;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredEffect;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredTrigger;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.wired.WiredEffectType;
import com.eu.habbo.habbohotel.wired.WiredHandler;
import com.eu.habbo.habbohotel.wired.WiredTriggerType;
import com.eu.habbo.habbohotel.items.interactions.wired.triggers.WiredTriggerUserVariableChanged;
import com.eu.habbo.messages.ClientMessage;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.wired.WiredSaveException;
import gnu.trove.procedure.TObjectProcedure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class WiredEffectDefineUserVariable extends InteractionWiredEffect {
    private static final Logger LOGGER = LoggerFactory.getLogger(WiredEffectDefineUserVariable.class);

    public static final WiredEffectType type = WiredEffectType.DEFINE_USER_VARIABLE;

    private String variableName = "";
    private String variableType = "number";
    private String defaultValue = "0";
    private boolean isPersistent = false;

    public WiredEffectDefineUserVariable(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredEffectDefineUserVariable(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
        super(id, userId, item, extradata, limitedStack, limitedSells);
    }

    public String getVariableName() {
        return variableName;
    }

    public void updateVariableName(String newName) {
        this.variableName = newName;
        this.needsUpdate(true);
    }

    @Override
    public boolean execute(RoomUnit roomUnit, Room room, Object[] stuff) {
        if (variableName.isEmpty()) return false;
        return true;
    }

    @Override
    public void onPickUp(Room room) {
        if (!variableName.isEmpty()) {
            int roomId = room.getId();
            try (Connection connection = Emulator.getDatabase().getDataSource().getConnection()) {
                deleteUserValues(connection, roomId);
                deleteVariableDefinition(connection, roomId);
            } catch (SQLException e) {
                LOGGER.error("Failed to delete user variable '{}' from room {}", variableName, roomId, e);
            }

            clearReferencesInRoom(room, variableName);
        }
        this.onPickUp();
    }

    @Override
    public void onPickUp() {
        this.variableName = "";
        this.variableType = "number";
        this.defaultValue = "0";
        this.isPersistent = false;
        this.setDelay(0);
    }

    private void deleteVariableDefinition(Connection connection, int roomId) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "DELETE FROM wired_variable_definitions WHERE room_id = ? AND variable_name = ?")) {
            stmt.setInt(1, roomId);
            stmt.setString(2, variableName);
            stmt.executeUpdate();
        }
    }

    private void deleteUserValues(Connection connection, int roomId) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "DELETE FROM wired_user_variable_values WHERE room_id = ? AND variable_name = ?")) {
            stmt.setInt(1, roomId);
            stmt.setString(2, variableName);
            stmt.executeUpdate();
        }
    }

    static void clearReferencesInRoom(Room room, String varName) {
        updateGiveReferences(room, varName, null);
        updateChangeReferences(room, varName, null);
        updateTriggerReferences(room, varName, null);
    }

    static void renameReferencesInRoom(Room room, String oldName, String newName) {
        updateGiveReferences(room, oldName, newName);
        updateChangeReferences(room, oldName, newName);
        updateTriggerReferences(room, oldName, newName);
    }

    private static void updateGiveReferences(Room room, String oldName, String newName) {
        java.util.Set<InteractionWiredEffect> giveWireds =
                room.getRoomSpecialTypes().getEffects(WiredEffectType.GIVE_USER_VARIABLE);
        if (giveWireds == null) return;
        for (InteractionWiredEffect effect : giveWireds) {
            WiredEffectGiveUserVariable give = (WiredEffectGiveUserVariable) effect;
            if (oldName.equals(give.getVariableName())) {
                give.updateVariableName(newName != null ? newName : "");
            }
        }
    }

    private static void updateChangeReferences(Room room, String oldName, String newName) {
        java.util.Set<InteractionWiredEffect> changeWireds =
                room.getRoomSpecialTypes().getEffects(WiredEffectType.CHANGE_USER_VARIABLE);
        if (changeWireds == null) return;
        for (InteractionWiredEffect effect : changeWireds) {
            WiredEffectChangeUserVariable change = (WiredEffectChangeUserVariable) effect;
            if (oldName.equals(change.getVariableName())) {
                change.updateVariableName(newName != null ? newName : "");
            }
        }
    }

    private static void updateTriggerReferences(Room room, String oldName, String newName) {
        gnu.trove.set.hash.THashSet<InteractionWiredTrigger> triggerWireds =
                room.getRoomSpecialTypes().getTriggers(WiredTriggerType.USER_VARIABLE_CHANGED);
        if (triggerWireds == null) return;
        for (InteractionWiredTrigger trigger : triggerWireds) {
            WiredTriggerUserVariableChanged t = (WiredTriggerUserVariableChanged) trigger;
            if (oldName.equals(t.getVariableName())) {
                t.updateVariableName(newName != null ? newName : "");
            }
        }
    }

    private void upsertVariableDefinition(Connection connection, int roomId) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "INSERT INTO wired_variable_definitions (room_id, variable_name, variable_type, default_value, is_persistent) " +
                "VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE variable_type = VALUES(variable_type), " +
                "default_value = VALUES(default_value), is_persistent = VALUES(is_persistent)")) {
            stmt.setInt(1, roomId);
            stmt.setString(2, variableName);
            stmt.setString(3, variableType);
            stmt.setString(4, defaultValue);
            stmt.setBoolean(5, isPersistent);
            stmt.executeUpdate();
        }
    }

    private void renameVariableInDb(Connection connection, int roomId, String oldName, String newName) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "UPDATE wired_variable_definitions SET variable_name = ? WHERE room_id = ? AND variable_name = ?")) {
            stmt.setString(1, newName);
            stmt.setInt(2, roomId);
            stmt.setString(3, oldName);
            stmt.executeUpdate();
        }
        try (PreparedStatement stmt = connection.prepareStatement(
                "UPDATE wired_user_variable_values SET variable_name = ? WHERE room_id = ? AND variable_name = ?")) {
            stmt.setString(1, newName);
            stmt.setInt(2, roomId);
            stmt.setString(3, oldName);
            stmt.executeUpdate();
        }
    }

    @Override
    public String getWiredData() {
        return WiredHandler.getGsonBuilder().create().toJson(
                new JsonData(variableName, variableType, defaultValue, isPersistent, getDelay()));
    }

    @Override
    public void loadWiredData(ResultSet set, Room room) throws SQLException {
        String wiredData = set.getString("wired_data");

        if (wiredData.startsWith("{")) {
            JsonData data = WiredHandler.getGsonBuilder().create().fromJson(wiredData, JsonData.class);
            this.variableName = data.variableName != null ? data.variableName : "";
            this.variableType = data.variableType != null ? data.variableType : "number";
            this.defaultValue = data.defaultValue != null ? data.defaultValue : "0";
            this.isPersistent = data.isPersistent;
            this.setDelay(data.delay);
        }
    }

    @Override
    public void serializeWiredData(ServerMessage message, Room room) {
        message.appendBoolean(false);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(this.getBaseItem().getSpriteId());
        message.appendInt(this.getId());
        message.appendString(variableName + "\t" + variableType + "\t" + defaultValue + "\t" + isPersistent);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(type.code);
        message.appendInt(this.getDelay());

        if (this.requiresTriggeringUser()) {
            List<Integer> invalidTriggers = new ArrayList<>();
            room.getRoomSpecialTypes().getTriggers(this.getX(), this.getY()).forEach(new TObjectProcedure<InteractionWiredTrigger>() {
                @Override
                public boolean execute(InteractionWiredTrigger object) {
                    if (!object.isTriggeredByRoomUnit()) {
                        invalidTriggers.add(object.getBaseItem().getSpriteId());
                    }
                    return true;
                }
            });
            message.appendInt(invalidTriggers.size());
            for (Integer i : invalidTriggers) {
                message.appendInt(i);
            }
        } else {
            message.appendInt(0);
        }
    }

    @Override
    public boolean saveData(ClientMessage packet, GameClient gameClient) throws WiredSaveException {
        packet.readInt();

        String rawString = packet.readString();
        String[] parts = rawString.split("\t", -1);

        if (parts.length < 4) throw new WiredSaveException("Invalid data for DefineUserVariable");

        String name = parts[0].trim();
        if (name.isEmpty()) throw new WiredSaveException("Variable name cannot be empty");
        if (name.length() > 100) throw new WiredSaveException("Variable name too long");

        String vType = parts[1].trim();
        if (!vType.equals("number") && !vType.equals("text") && !vType.equals("boolean") && !vType.equals("user"))
            throw new WiredSaveException("Invalid variable type: " + vType);

        String defValue = parts[2].trim();
        boolean persistent = Boolean.parseBoolean(parts[3].trim());

        packet.readInt();

        int delay = packet.readInt();
        if (delay > Emulator.getConfig().getInt("hotel.wired.max_delay", 20))
            throw new WiredSaveException("Delay too long");

        Room room = gameClient.getHabbo().getHabboInfo().getCurrentRoom();

        if (room != null) {
            java.util.Set<InteractionWiredEffect> defineWireds =
                    room.getRoomSpecialTypes().getEffects(WiredEffectType.DEFINE_USER_VARIABLE);
            if (defineWireds != null) {
                for (InteractionWiredEffect effect : defineWireds) {
                    WiredEffectDefineUserVariable other = (WiredEffectDefineUserVariable) effect;
                    if (other.getId() != this.getId() && name.equals(other.variableName)) {
                        throw new WiredSaveException("Variable name '" + name + "' already exists in this room");
                    }
                }
            }

            String oldName = this.variableName;
            boolean nameChanged = !oldName.isEmpty() && !oldName.equals(name);

            try (Connection connection = Emulator.getDatabase().getDataSource().getConnection()) {
                if (nameChanged) {
                    renameVariableInDb(connection, room.getId(), oldName, name);
                    renameReferencesInRoom(room, oldName, name);
                }
                this.variableName = name;
                this.variableType = vType;
                this.defaultValue = defValue;
                this.isPersistent = persistent;
                this.setDelay(delay);
                upsertVariableDefinition(connection, room.getId());
            } catch (SQLException e) {
                LOGGER.error("Failed to save user variable definition '{}' in room {}", name, room.getId(), e);
                throw new WiredSaveException("Database error while saving variable definition");
            }
        } else {
            this.variableName = name;
            this.variableType = vType;
            this.defaultValue = defValue;
            this.isPersistent = persistent;
            this.setDelay(delay);
        }

        return true;
    }

    @Override
    public WiredEffectType getType() {
        return type;
    }

    @Override
    public boolean requiresTriggeringUser() {
        return false;
    }

    static class JsonData {
        String variableName;
        String variableType;
        String defaultValue;
        boolean isPersistent;
        int delay;

        public JsonData(String variableName, String variableType, String defaultValue,
                        boolean isPersistent, int delay) {
            this.variableName = variableName;
            this.variableType = variableType;
            this.defaultValue = defaultValue;
            this.isPersistent = isPersistent;
            this.delay = delay;
        }
    }
}
