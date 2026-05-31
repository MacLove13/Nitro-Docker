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

public class WiredEffectChangeUserVariable extends InteractionWiredEffect {
    private static final Logger LOGGER = LoggerFactory.getLogger(WiredEffectChangeUserVariable.class);

    public static final WiredEffectType type = WiredEffectType.CHANGE_USER_VARIABLE;

    private static final String OP_ADD = "+";
    private static final String OP_SUBTRACT = "-";
    private static final String OP_MULTIPLY = "*";
    private static final String OP_DIVIDE = "/";
    private static final String OP_SET = "=";
    private static final String OP_CONCAT = "concat";

    private String variableName = "";
    private String variableType = "number";
    private String defaultValue = "0";
    private boolean isPersistent = false;
    private String operation = "=";
    private String operationValue = "0";

    public WiredEffectChangeUserVariable(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredEffectChangeUserVariable(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
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
            String currentValue = loadUserVariableValue(connection, roomId, userId);
            String newValue = applyOperation(currentValue);
            if (newValue == null) return false;
            upsertUserVariableValue(connection, roomId, userId, newValue);
        } catch (SQLException e) {
            LOGGER.error("Failed to change user variable '{}' for user {} in room {}", variableName, userId, roomId, e);
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

    private String loadUserVariableValue(Connection connection, int roomId, int userId) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT value FROM wired_user_variable_values WHERE room_id = ? AND user_id = ? AND variable_name = ? LIMIT 1")) {
            stmt.setInt(1, roomId);
            stmt.setInt(2, userId);
            stmt.setString(3, variableName);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getString("value");
                }
            }
        }
        return defaultValue;
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

    private String applyOperation(String currentValue) {
        try {
            switch (operation) {
                case OP_SET:
                    return operationValue;

                case OP_CONCAT:
                    if (!variableType.equals("text")) return null;
                    return currentValue + operationValue;

                case OP_ADD:
                    if (!variableType.equals("number")) return null;
                    return String.valueOf(Double.parseDouble(currentValue) + Double.parseDouble(operationValue));

                case OP_SUBTRACT:
                    if (!variableType.equals("number")) return null;
                    return String.valueOf(Double.parseDouble(currentValue) - Double.parseDouble(operationValue));

                case OP_MULTIPLY:
                    if (!variableType.equals("number")) return null;
                    return String.valueOf(Double.parseDouble(currentValue) * Double.parseDouble(operationValue));

                case OP_DIVIDE:
                    if (!variableType.equals("number")) return null;
                    double divisor = Double.parseDouble(operationValue);
                    if (divisor == 0) {
                        LOGGER.warn("Division by zero prevented for variable '{}' in room", variableName);
                        return null;
                    }
                    return String.valueOf(Double.parseDouble(currentValue) / divisor);

                default:
                    return null;
            }
        } catch (NumberFormatException e) {
            LOGGER.warn("Failed to apply operation '{}' on value '{}' with operand '{}'",
                    operation, currentValue, operationValue);
            return null;
        }
    }

    @Override
    public String getWiredData() {
        return WiredHandler.getGsonBuilder().create().toJson(
                new JsonData(variableName, variableType, defaultValue, isPersistent, operation, operationValue, getDelay()));
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
            this.operation = data.operation != null ? data.operation : "=";
            this.operationValue = data.operationValue != null ? data.operationValue : "0";
            this.setDelay(data.delay);
        }
    }

    @Override
    public void onPickUp() {
        this.variableName = "";
        this.variableType = "number";
        this.defaultValue = "0";
        this.isPersistent = false;
        this.operation = "=";
        this.operationValue = "0";
        this.setDelay(0);
    }

    @Override
    public void serializeWiredData(ServerMessage message, Room room) {
        message.appendBoolean(false);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(this.getBaseItem().getSpriteId());
        message.appendInt(this.getId());
        message.appendString(variableName + "\t" + variableType + "\t" + defaultValue + "\t" + isPersistent + "\t" + operation + "\t" + operationValue);
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

        if (parts.length < 6) throw new WiredSaveException("Invalid data for ChangeUserVariable");

        String name = parts[0].trim();
        if (name.isEmpty()) throw new WiredSaveException("Variable name cannot be empty");
        if (name.length() > 100) throw new WiredSaveException("Variable name too long");

        String vType = parts[1].trim();
        if (!vType.equals("number") && !vType.equals("text") && !vType.equals("boolean") && !vType.equals("user"))
            throw new WiredSaveException("Invalid variable type: " + vType);

        String defValue = parts[2].trim();
        boolean persistent = Boolean.parseBoolean(parts[3].trim());
        String op = parts[4].trim();
        String opValue = parts[5].trim();

        validateOperationForType(vType, op, opValue);

        packet.readInt();

        int delay = packet.readInt();
        if (delay > Emulator.getConfig().getInt("hotel.wired.max_delay", 20))
            throw new WiredSaveException("Delay too long");

        this.variableName = name;
        this.variableType = vType;
        this.defaultValue = defValue;
        this.isPersistent = persistent;
        this.operation = op;
        this.operationValue = opValue;
        this.setDelay(delay);

        return true;
    }

    private void validateOperationForType(String vType, String op, String opValue) throws WiredSaveException {
        switch (vType) {
            case "number":
                if (op.equals(OP_CONCAT))
                    throw new WiredSaveException("concat is not allowed for type 'number'");
                try {
                    double val = Double.parseDouble(opValue);
                    if (op.equals(OP_DIVIDE) && val == 0)
                        throw new WiredSaveException("Division by zero is not allowed");
                } catch (NumberFormatException e) {
                    if (!op.equals(OP_SET))
                        throw new WiredSaveException("Arithmetic operations (+, -, *, /) require a numeric value for type 'number'");
                }
                break;
            case "text":
                if (!op.equals(OP_SET) && !op.equals(OP_CONCAT))
                    throw new WiredSaveException("Only '=' and 'concat' are allowed for type 'text'");
                break;
            case "boolean":
                if (!op.equals(OP_SET))
                    throw new WiredSaveException("Only '=' is allowed for type 'boolean'");
                if (!opValue.equals("true") && !opValue.equals("false"))
                    throw new WiredSaveException("Value must be 'true' or 'false' for type 'boolean'");
                break;
            case "user":
                if (!op.equals(OP_SET))
                    throw new WiredSaveException("Only '=' is allowed for type 'user'");
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
        String operation;
        String operationValue;
        int delay;

        public JsonData(String variableName, String variableType, String defaultValue,
                        boolean isPersistent, String operation, String operationValue, int delay) {
            this.variableName = variableName;
            this.variableType = variableType;
            this.defaultValue = defaultValue;
            this.isPersistent = isPersistent;
            this.operation = operation;
            this.operationValue = operationValue;
            this.delay = delay;
        }
    }
}
