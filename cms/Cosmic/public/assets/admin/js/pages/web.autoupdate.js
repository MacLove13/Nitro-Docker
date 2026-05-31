/**
 * web.autoupdate.js
 * Handles the Auto Update housekeeping panel.
 *
 * Tabs: SWF Packs | Mobílias (Furniture) | Effects | Logs
 */

'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

var AU = {
    packs: {page: 1, perPage: 50, status: ''},
    furni: {page: 1, perPage: 50, status: ''},
    effects: {page: 1, perPage: 50, status: ''},
    logs: {limit: 200, category: '', date: ''}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function auStatusBadge(status) {
    var map = {
        pending:    '<span class="kt-badge kt-badge--unified-warning kt-badge--lg kt-badge--rounded kt-badge--bold">Pendente</span>',
        processing: '<span class="kt-badge kt-badge--unified-primary kt-badge--lg kt-badge--rounded kt-badge--bold">Processando</span>',
        done:       '<span class="kt-badge kt-badge--unified-success kt-badge--lg kt-badge--rounded kt-badge--bold">Concluído</span>',
        error:      '<span class="kt-badge kt-badge--unified-danger kt-badge--lg kt-badge--rounded kt-badge--bold">Erro</span>'
    };
    return map[status] || status;
}

function auTimestamp(ts) {
    if (!ts) return '–';
    var d = new Date(ts * 1000);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

function auAddBtn(id, type, status) {
    if (status === 'done') {
        return '<span class="text-success"><i class="la la-check"></i> Adicionado</span>';
    }
    if (status === 'processing') {
        return '<span class="text-primary"><i class="la la-spinner la-spin"></i> Processando…</span>';
    }
    return '<button class="btn btn-sm btn-primary au-add-btn" data-id="' + id + '" data-type="' + type + '">' +
           '<i class="la la-plus"></i> Adicionar</button>';
}

function auErrorBtn(err) {
    if (!err) return '';
    return ' <button class="btn btn-sm btn-danger au-err-btn" data-err="' + encodeURIComponent(err) + '">' +
           '<i class="la la-warning"></i></button>';
}

function auPagination(containerId, current, total, perPage, onPageChange) {
    var pages = Math.ceil(total / perPage);
    if (pages <= 1) { $('#' + containerId).html(''); return; }
    var html = '<ul class="pagination pagination-sm justify-content-center">';
    var from = Math.max(1, current - 4);
    var to   = Math.min(pages, current + 4);
    if (current > 1) {
        html += '<li class="page-item"><a class="page-link au-page" data-page="' + (current - 1) + '">&laquo;</a></li>';
    }
    for (var p = from; p <= to; p++) {
        html += '<li class="page-item' + (p === current ? ' active' : '') + '">' +
                '<a class="page-link au-page" data-page="' + p + '">' + p + '</a></li>';
    }
    if (current < pages) {
        html += '<li class="page-item"><a class="page-link au-page" data-page="' + (current + 1) + '">&raquo;</a></li>';
    }
    html += '</ul>';
    $('#' + containerId).html(html).find('.au-page').on('click', function () {
        onPageChange(parseInt($(this).data('page')));
    });
}

// ---------------------------------------------------------------------------
// POST helper (calls CMS housekeeping API)
// ---------------------------------------------------------------------------

function auPost(path, data, success, error) {
    $.ajax({
        url: path,
        method: 'POST',
        data: data,
        dataType: 'json',
        success: success,
        error: function (xhr) {
            var msg = 'Erro de comunicação';
            try { msg = JSON.parse(xhr.responseText).error || msg; } catch(e) {}
            if (error) error(msg); else toastr.error(msg);
        }
    });
}

// ---------------------------------------------------------------------------
// Load SWF Packs
// ---------------------------------------------------------------------------

function loadPacks() {
    auPost('/housekeeping/api/autoUpdate/getPacks', {
        page: AU.packs.page,
        per_page: AU.packs.perPage,
        status: AU.packs.status
    }, function (data) {
        if (data.error) { toastr.error(data.error); return; }
        var rows = data.items || [];
        var total = data.total || 0;
        $('#badge-packs').text(total);
        var html = '';
        if (!rows.length) {
            html = '<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>';
        } else {
            rows.forEach(function (r) {
                html += '<tr>' +
                    '<td>' + r.id + '</td>' +
                    '<td><code>' + escapeHtml(r.revision_name) + '</code></td>' +
                    '<td>' + auStatusBadge(r.status) + auErrorBtn(r.error_message) + '</td>' +
                    '<td>' + (r.files_added || 0) + '</td>' +
                    '<td>' + auTimestamp(r.created_at) + '</td>' +
                    '<td>' + auAddBtn(r.id, 'pack', r.status) + '</td>' +
                    '</tr>';
            });
        }
        $('#tblPacksBody').html(html);
        auPagination('paginationPacks', AU.packs.page, total, AU.packs.perPage, function (p) {
            AU.packs.page = p; loadPacks();
        });
    });
}

// ---------------------------------------------------------------------------
// Load Furniture
// ---------------------------------------------------------------------------

function loadFurniture() {
    auPost('/housekeeping/api/autoUpdate/getFurniture', {
        page: AU.furni.page,
        per_page: AU.furni.perPage,
        status: AU.furni.status
    }, function (data) {
        if (data.error) { toastr.error(data.error); return; }
        var rows = data.items || [];
        var total = data.total || 0;
        $('#badge-furniture').text(total);
        var html = '';
        if (!rows.length) {
            html = '<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>';
        } else {
            rows.forEach(function (r) {
                html += '<tr>' +
                    '<td>' + r.id + '</td>' +
                    '<td><code>' + escapeHtml(r.class_name) + '</code></td>' +
                    '<td>' + (r.revision || 0) + '</td>' +
                    '<td>' + auStatusBadge(r.status) + auErrorBtn(r.error_message) + '</td>' +
                    '<td>' + auTimestamp(r.created_at) + '</td>' +
                    '<td>' + auAddBtn(r.id, 'furniture', r.status) + '</td>' +
                    '</tr>';
            });
        }
        $('#tblFurniBody').html(html);
        auPagination('paginationFurni', AU.furni.page, total, AU.furni.perPage, function (p) {
            AU.furni.page = p; loadFurniture();
        });
    });
}

// ---------------------------------------------------------------------------
// Load Effects
// ---------------------------------------------------------------------------

function loadEffects() {
    auPost('/housekeeping/api/autoUpdate/getEffects', {
        page: AU.effects.page,
        per_page: AU.effects.perPage,
        status: AU.effects.status
    }, function (data) {
        if (data.error) { toastr.error(data.error); return; }
        var rows = data.items || [];
        var total = data.total || 0;
        $('#badge-effects').text(total);
        var html = '';
        if (!rows.length) {
            html = '<tr><td colspan="6" class="text-center text-muted">Nenhum registro encontrado.</td></tr>';
        } else {
            rows.forEach(function (r) {
                html += '<tr>' +
                    '<td>' + r.id + '</td>' +
                    '<td><code>' + escapeHtml(r.effect_name) + '</code></td>' +
                    '<td>' + (r.revision || 0) + '</td>' +
                    '<td>' + auStatusBadge(r.status) + auErrorBtn(r.error_message) + '</td>' +
                    '<td>' + auTimestamp(r.created_at) + '</td>' +
                    '<td>' + auAddBtn(r.id, 'effect', r.status) + '</td>' +
                    '</tr>';
            });
        }
        $('#tblEffectsBody').html(html);
        auPagination('paginationEffects', AU.effects.page, total, AU.effects.perPage, function (p) {
            AU.effects.page = p; loadEffects();
        });
    });
}

// ---------------------------------------------------------------------------
// Load Logs
// ---------------------------------------------------------------------------

function loadLogs() {
    auPost('/housekeeping/api/autoUpdate/getLogs', {
        limit: AU.logs.limit,
        category: AU.logs.category,
        date: AU.logs.date
    }, function (data) {
        if (data.error) { toastr.error(data.error); return; }
        var logs = data.logs || [];
        var html = '';
        if (!logs.length) {
            html = '<tr><td colspan="4" class="text-center text-muted">Nenhum log encontrado.</td></tr>';
        } else {
            var catMap = {packs: 'warning', furniture: 'info', effects: 'success', system: 'secondary'};
            logs.forEach(function (l) {
                var cat = l.category || 'system';
                var ts  = l.created_at ? new Date(l.created_at * 1000).toLocaleTimeString('pt-BR') : '–';
                html += '<tr>' +
                    '<td>' + escapeHtml(l.log_date || '') + '</td>' +
                    '<td><span class="kt-badge kt-badge--' + (catMap[cat] || 'secondary') + ' kt-badge--inline">' +
                        escapeHtml(cat) + '</span></td>' +
                    '<td>' + escapeHtml(l.message || '') + '</td>' +
                    '<td>' + ts + '</td>' +
                    '</tr>';
            });
        }
        $('#tblLogsBody').html(html);
    });
}

// ---------------------------------------------------------------------------
// Process action
// ---------------------------------------------------------------------------

function processItem(id, type) {
    var urlMap = {
        pack:      '/housekeeping/api/autoUpdate/processPack',
        furniture: '/housekeeping/api/autoUpdate/processFurniture',
        effect:    '/housekeeping/api/autoUpdate/processEffect'
    };
    var url = urlMap[type];
    if (!url) return;

    auPost(url, {id: id}, function (data) {
        if (data.error) {
            toastr.error(data.error);
            return;
        }
        toastr.info('Processamento iniciado…');
        // Reload the active tab after a short delay
        setTimeout(function () {
            if (type === 'pack')      loadPacks();
            if (type === 'furniture') loadFurniture();
            if (type === 'effect')    loadEffects();
        }, 1500);
    });
}

// ---------------------------------------------------------------------------
// XSS escape helper
// ---------------------------------------------------------------------------

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// Event bindings
// ---------------------------------------------------------------------------

$(document).ready(function () {

    // Initial load
    loadPacks();

    // Tab switch
    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        var target = $(e.target).attr('href');
        if (target === '#pane-packs')      loadPacks();
        if (target === '#pane-furniture')  loadFurniture();
        if (target === '#pane-effects')    loadEffects();
        if (target === '#pane-logs')       loadLogs();
    });

    // Status filters
    $('#filterPackStatus').on('change', function () {
        AU.packs.status = $(this).val(); AU.packs.page = 1; loadPacks();
    });
    $('#filterFurniStatus').on('change', function () {
        AU.furni.status = $(this).val(); AU.furni.page = 1; loadFurniture();
    });
    $('#filterEffectStatus').on('change', function () {
        AU.effects.status = $(this).val(); AU.effects.page = 1; loadEffects();
    });

    // Log filters
    $('#btnFilterLogs').on('click', function () {
        AU.logs.category = $('#filterLogCategory').val();
        AU.logs.date     = $('#filterLogDate').val();
        loadLogs();
    });

    // Add / Adicionar button (delegated)
    $(document).on('click', '.au-add-btn', function () {
        var id   = $(this).data('id');
        var type = $(this).data('type');
        $(this).replaceWith('<span class="text-primary"><i class="la la-spinner la-spin"></i></span>');
        processItem(id, type);
    });

    // Error detail button
    $(document).on('click', '.au-err-btn', function () {
        var msg = decodeURIComponent($(this).data('err'));
        $('#errorModalText').text(msg);
        $('#errorModal').modal('show');
    });

    // Force scrape
    $('#btnForceScrape').on('click', function () {
        var $btn = $(this).prop('disabled', true).html('<i class="la la-spinner la-spin"></i> Buscando…');
        auPost('/housekeeping/api/autoUpdate/triggerScrape', {}, function (data) {
            if (data.error) {
                toastr.error(data.error);
            } else {
                toastr.success('Busca iniciada em segundo plano.');
            }
        }, function (msg) {
            toastr.error(msg);
        });
        setTimeout(function () {
            $btn.prop('disabled', false).html('<i class="la la-refresh"></i> Buscar novos agora');
        }, 3000);
    });

    // Auto-refresh processing items every 10s
    setInterval(function () {
        var activeTab = $('#autoUpdateTabs .nav-link.active').attr('href');
        if (activeTab === '#pane-packs')     loadPacks();
        if (activeTab === '#pane-furniture') loadFurniture();
        if (activeTab === '#pane-effects')   loadEffects();
    }, 10000);
});
