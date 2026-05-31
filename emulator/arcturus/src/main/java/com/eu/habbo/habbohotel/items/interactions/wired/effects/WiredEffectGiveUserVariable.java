package com.eu.habbo.habbohotel.items.interactions.wired.effects;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredEffect;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredTrigger;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.wired.WiredEffectType;
import com.eu.habbo.habbohotel.wired.WiredHandler;
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

public class WiredEffectGiveUserVariable extends InteractionWiredEffect {
    private static final Logger LOGGER = LoggerFactory.getLogger(WiredEffectGiveUserVariable.class);

    public static final WiredEffectType type = WiredEffectType.GIVE_USER_VARIABLE;

    private String variableName = "";
    private String variableType = "number";
    private String defaultValue = "0";
    private boolean isPersistent = false;
    private String valueToSet = "0";

    public WiredEffectGiveUserVariable(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredEffectGiveUserVariable(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
        super(id, userId, item, extradata, limitedStack, limitedSells);
    }

    @Override
    public boolean execute(RoomUnit roomUnit, Room room, Object[] stuff) {
        Habbo habbo = room.getHabbo(roomUnit);

        if (habbo == null || variableName.isEmpty()) return false;

        int roomId = room.getId();
        int userId = habbo.getHabboInfo().getId();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection()) {
            upsertVariableDefinition(connection, roomId);
            upsertUserVariableValue(connection, roomId, userId, valueToSet);
        } catch (SQLException e) {
            LOGGER.error("Failed to give user variable '{}' to user {} in room {}", variableName, userId, roomId, e);
            return false;
        }

        return true;
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

    private void upsertUserVariableValue(Connection connection, int roomId, int userId, String value) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "INSERT INTO wired_user_variable_values (room_id, user_id, variable_name, value) " +
                "VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)")) {
            stmt.setInt(1, roomId);
            stmt.setInt(2, userId);
            stmt.setString(3, variableName);
            stmt.setString(4, value);
            stmt.executeUpdate();
        }
    }

    @Override
    public String getWiredData() {
        return WiredHandler.getGsonBuilder().create().toJson(
                new JsonData(variableName, variableType, defaultValue, isPersistent, valueToSet, getDelay()));
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
            this.valueToSet = data.valueToSet != null ? data.valueToSet : "0";
            this.setDelay(data.delay);
        }
    }

    @Override
    public void onPickUp() {
        this.variableName = "";
        this.variableType = "number";
        this.defaultValue = "0";
        this.isPersistent = false;
        this.valueToSet = "0";
        this.setDelay(0);
    }

    @Override
    public void serializeWiredData(ServerMessage message, Room room) {
        message.appendBoolean(false);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(this.getBaseItem().getSpriteId());
        message.appendInt(this.getId());
        message.appendString(variableName + "\t" + variableType + "\t" + defaultValue + "\t" + isPersistent + "\t" + valueToSet);
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

        if (parts.length < 5) throw new WiredSaveException("Invalid data for GiveUserVariable");

        String name = parts[0].trim();
        if (name.isEmpty()) throw new WiredSaveException("Variable name cannot be empty");
        if (name.length() > 100) throw new WiredSaveException("Variable name too long");

        String vType = parts[1].trim();
        if (!vType.equals("number") && !vType.equals("text") && !vType.equals("boolean") && !vType.equals("user"))
            throw new WiredSaveException("Invalid variable type: " + vType);

        String defValue = parts[2].trim();
        boolean persistent = Boolean.parseBoolean(parts[3].trim());
        String value = parts[4].trim();

        validateValue(vType, value);

        packet.readInt();

        int delay = packet.readInt();
        if (delay > Emulator.getConfig().getInt("hotel.wired.max_delay", 20))
            throw new WiredSaveException("Delay too long");

        this.variableName = name;
        this.variableType = vType;
        this.defaultValue = defValue;
        this.isPersistent = persistent;
        this.valueToSet = value;
        this.setDelay(delay);

        return true;
    }

    private void validateValue(String vType, String value) throws WiredSaveException {
        switch (vType) {
            case "number":
                try {
                    Double.parseDouble(value);
                } catch (NumberFormatException e) {
                    throw new WiredSaveException("Value must be a number for type 'number'");
                }
                break;
            case "boolean":
                if (!value.equals("true") && !value.equals("false"))
                    throw new WiredSaveException("Value must be 'true' or 'false' for type 'boolean'");
                break;
        }
    }

    @Override
    public WiredEffectType getType() {
        return type;
    }

    @Override
    public boolean requiresTriggeringUser() {
        return true;
    }

    static class JsonData {
        String variableName;
        String variableType;
        String defaultValue;
        boolean isPersistent;
        String valueToSet;
        int delay;

        public JsonData(String variableName, String variableType, String defaultValue,
                        boolean isPersistent, String valueToSet, int delay) {
            this.variableName = variableName;
            this.variableType = variableType;
            this.defaultValue = defaultValue;
            this.isPersistent = isPersistent;
            this.valueToSet = valueToSet;
            this.delay = delay;
        }
    }
}
