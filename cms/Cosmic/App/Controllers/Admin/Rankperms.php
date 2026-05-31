<?php
namespace App\Controllers\Admin;

use App\Models\Admin;
use Core\View;
use QueryBuilder;

class Rankperms
{
    public function view()
    {
        View::renderTemplate('Admin/Management/rankperms.html', ['permission' => 'housekeeping_permissions']);
    }

    /**
     * Returns all ranks with their full permissions row.
     */
    public function getranks()
    {
        $ranks = QueryBuilder::table('permissions')
            ->orderBy('level', 'desc')
            ->get();

        echo json_encode(array_values((array) $ranks));
        exit;
    }

    /**
     * Returns all column names (permission keys) from the permissions table.
     */
    public function getcolumns()
    {
        $cols = QueryBuilder::query("SHOW COLUMNS FROM permissions")->get();
        $result = [];
        foreach ($cols as $col) {
            $result[] = ['field' => $col->Field, 'type' => $col->Type];
        }
        echo json_encode($result);
        exit;
    }

    /**
     * Toggle a single permission column for a rank.
     * POST: rank_id, column, value (new value: '0' or '1')
     */
    public function toggleperm()
    {
        $rank_id = (int) (input()->post('rank_id')->value ?? 0);
        $column  = input()->post('column')->value ?? '';
        $value   = input()->post('value')->value ?? '0';

        // Whitelist: only allow cmd_/acc_ columns
        if ($rank_id <= 0 || !preg_match('/^(cmd_|acc_)/', $column)) {
            response()->json(['status' => 'error', 'message' => 'Invalid input.']);
            return;
        }

        // Validate allowed values for this column
        $colInfo = QueryBuilder::query("SHOW COLUMNS FROM permissions WHERE Field = ?", [$column])->first();
        if (!$colInfo) {
            response()->json(['status' => 'error', 'message' => 'Column not found.']);
            return;
        }

        // Determine allowed values from enum type
        preg_match_all("/'([^']+)'/", $colInfo->Type, $matches);
        $allowed = $matches[1] ?? ['0', '1'];

        if (!in_array($value, $allowed)) {
            response()->json(['status' => 'error', 'message' => 'Value not allowed.']);
            return;
        }

        QueryBuilder::table('permissions')
            ->where('id', $rank_id)
            ->update([$column => $value]);

        response()->json(['status' => 'success', 'message' => 'Permission updated.']);
    }
}
