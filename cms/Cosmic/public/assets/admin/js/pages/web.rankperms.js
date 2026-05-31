/**
 * web.rankperms.js — Rank Permissions Manager
 * Lists all emulator ranks; click a rank to edit its cmd_/acc_ permissions.
 */
(function ($) {
    'use strict';

    var currentRankId = null;
    var currentRank = null;
    var allColumns = [];
    var allRanks = [];

    var BADGE_MAP = {
        '0': '<span class="kt-badge kt-badge--danger  kt-badge--inline">0</span>',
        '1': '<span class="kt-badge kt-badge--success kt-badge--inline">1</span>',
        '2': '<span class="kt-badge kt-badge--warning kt-badge--inline">2</span>',
    };

    function badgeFor(val) {
        return BADGE_MAP[String(val)] || '<span class="kt-badge kt-badge--unified-dark kt-badge--inline">' + val + '</span>';
    }

    /* ---------- Load ranks ---------- */
    function loadRanks() {
        $.post('/housekeeping/api/rankperms/getranks', function (data) {
            allRanks = data;
            renderRankCards(data);
        });
    }

    function renderRankCards(ranks) {
        var html = '';
        $.each(ranks, function (i, r) {
            var colorClass = r.level >= 6 ? 'kt-bg-danger' : r.level >= 4 ? 'kt-bg-warning' : 'kt-bg-brand';
            html += '<div class="col-md-3 col-sm-6 mb-4">' +
                '<div class="kt-portlet kt-portlet--fit kt-portlet--head-noborder kt-portlet--border-bottom-brand" style="cursor:pointer" data-rank-id="' + r.id + '">' +
                '<div class="kt-portlet__head kt-portlet__space-x ' + colorClass + '" style="border-radius:4px 4px 0 0">' +
                '<div class="kt-portlet__head-label"><h3 class="kt-portlet__head-title text-white">' + r.rank_name + '</h3></div>' +
                '<div class="kt-portlet__head-toolbar"><span class="kt-badge kt-badge--light kt-badge--inline">Level ' + r.level + '</span></div>' +
                '</div>' +
                '<div class="kt-portlet__body text-center py-3">' +
                '<p class="mb-1 text-muted">Badge: <strong>' + (r.badge || '—') + '</strong></p>' +
                '<button class="btn btn-sm btn-label-brand editRankBtn" data-rank-id="' + r.id + '">Edit Permissions</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        });
        $('#rankCards').html(html);

        $('.editRankBtn, [data-rank-id]').off('click').on('click', function (e) {
            e.stopPropagation();
            var rid = $(this).data('rank-id');
            openEditor(rid);
        });
    }

    /* ---------- Open editor ---------- */
    function openEditor(rankId) {
        currentRankId = rankId;
        currentRank = null;
        $.each(allRanks, function (i, r) { if (r.id == rankId) { currentRank = r; return false; } });

        if (!currentRank) return;

        $('#editorTitle').text('Permissions — ' + currentRank.rank_name + ' (Level ' + currentRank.level + ')');
        $('#rankListView').hide();
        $('#permEditorView').show();
        $('#permSearch').val('');

        if (allColumns.length === 0) {
            $.post('/housekeeping/api/rankperms/getcolumns', function (cols) {
                allColumns = cols;
                renderPermTable(currentRank, '');
            });
        } else {
            renderPermTable(currentRank, '');
        }
    }

    /* ---------- Render table ---------- */
    function renderPermTable(rank, filter) {
        var rows = '';
        var skip = ['id', 'rank_name', 'badge', 'level', 'room_effect', 'log_commands',
            'prefix', 'prefix_color', 'auto_credits_amount', 'auto_pixels_amount',
            'auto_gotw_amount', 'auto_points_amount'];

        $.each(allColumns, function (i, col) {
            var field = col.field;
            if (skip.indexOf(field) !== -1) return;
            if (filter && field.toLowerCase().indexOf(filter.toLowerCase()) === -1) return;

            var val = rank[field] !== undefined ? String(rank[field]) : '0';

            // Build allowed values from enum type
            var allowed = ['0', '1'];
            var m = col.type.match(/enum\(([^)]+)\)/);
            if (m) {
                allowed = m[1].replace(/'/g, '').split(',');
            }

            var btnGroup = '';
            $.each(allowed, function (j, av) {
                var active = (val === av) ? 'active' : '';
                var variant = av === '0' ? 'btn-label-danger' : av === '1' ? 'btn-label-success' : 'btn-label-warning';
                btnGroup += '<button class="btn btn-sm ' + variant + ' ' + active + ' permToggleBtn" ' +
                    'data-column="' + field + '" data-value="' + av + '">' + av + '</button> ';
            });

            rows += '<tr class="perm-row" data-field="' + field + '">' +
                '<td><code>' + field + '</code></td>' +
                '<td>' + badgeFor(val) + '</td>' +
                '<td><div class="btn-group" role="group">' + btnGroup + '</div></td>' +
                '</tr>';
        });

        $('#permTableBody').html(rows);
        bindToggle();
    }

    /* ---------- Bind toggle buttons ---------- */
    function bindToggle() {
        $('.permToggleBtn').off('click').on('click', function () {
            var $btn = $(this);
            var col = $btn.data('column');
            var val = String($btn.data('value'));

            $.post('/housekeeping/api/rankperms/toggleperm', {
                rank_id: currentRankId,
                column: col,
                value: val
            }, function (res) {
                if (res.status === 'success') {
                    // Update currentRank in memory
                    currentRank[col] = val;
                    // Update badge in this row
                    var $row = $btn.closest('tr');
                    $row.find('td:nth-child(2)').html(badgeFor(val));
                    // Update active state
                    $row.find('.permToggleBtn').removeClass('active');
                    $btn.addClass('active');
                    toastr.success(col + ' set to ' + val);
                } else {
                    toastr.error(res.message || 'Failed to update.');
                }
            });
        });
    }

    /* ---------- Search ---------- */
    $('#permSearch').on('input', function () {
        if (!currentRank) return;
        renderPermTable(currentRank, $(this).val());
    });

    /* ---------- Back button ---------- */
    $('#btnBack').on('click', function () {
        $('#permEditorView').hide();
        $('#rankListView').show();
    });

    /* ---------- Init ---------- */
    loadRanks();

}(jQuery));
