/**
 * Furniture Creator – Housekeeping page script
 *
 * Handles:
 *   - Rotation image upload preview
 *   - Form submission (multipart/form-data)
 *   - Status polling for 'processing' items
 *   - Item list datatable
 *   - Detail / preview panel
 *   - "Add to Game" action
 */

var furniCreator = function () {

    var currentItemId = null;
    var pollTimer = null;
    var assetBaseUrl = Site.game_url || '';

    // ------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------

    function showPanel(name) {
        $('#furniCreatorForm').hide();
        $('#furniCreatorList').hide();
        $('#furniCreatorDetail').hide();
        $('#' + name).show();
        clearPoll();
    }

    function clearPoll() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // ------------------------------------------------------------------
    // Init
    // ------------------------------------------------------------------

    return {

        init: function () {
            furniCreator.loadCatalogPages();
            furniCreator.initImagePreviews();
            furniCreator.initFormSubmit();
            furniCreator.initNavButtons();

            // Start on the list view
            furniCreator.loadList();
        },

        // ------------------------------------------------------------------
        // Catalog pages dropdown
        // ------------------------------------------------------------------

        loadCatalogPages: function () {
            $.ajax({
                url: '/housekeeping/api/catalog/getCatalogPages',
                type: 'post',
                headers: { 'Authorization': 'housekeeping' },
                dataType: 'json',
                success: function (data) {
                    var $sel = $('#furniPageSelect');
                    $sel.empty();
                    $.each(data, function (i, page) {
                        $sel.append(new Option(page.caption + ' (#' + page.id + ')', page.id));
                    });
                    $sel.select2({ placeholder: 'Select a page' });
                }
            });
        },

        // ------------------------------------------------------------------
        // Image upload preview
        // ------------------------------------------------------------------

        initImagePreviews: function () {
            $(document).on('change', '.rotation-upload', function () {
                var $input = $(this);
                var $preview = $input.closest('.kt-portlet__body').find('.rotation-preview');
                var file = this.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    $preview.attr('src', e.target.result).show();
                };
                reader.readAsDataURL(file);
            });
        },

        // ------------------------------------------------------------------
        // Form submission
        // ------------------------------------------------------------------

        initFormSubmit: function () {
            $('#createFurniForm').on('submit', function (e) {
                e.preventDefault();
                var $btn = $('#btnCreateFurni');
                $btn.prop('disabled', true).text('Creating…');

                var formData = new FormData(this);

                $.ajax({
                    url: '/housekeeping/api/furniCreator/create',
                    type: 'post',
                    headers: { 'Authorization': 'housekeeping_furni_creator' },
                    data: formData,
                    processData: false,
                    contentType: false,
                    dataType: 'json',
                    success: function (data) {
                        if (data.status === 'success') {
                            toastr['success']('Furni creation job submitted! Processing…');
                            furniCreator.loadList();
                            showPanel('furniCreatorList');
                            // Open detail for the new item
                            if (data.id) {
                                setTimeout(function () {
                                    furniCreator.openDetail(data.id);
                                }, 500);
                            }
                        } else {
                            toastr['error'](data.message || data.error || 'An error occurred.');
                        }
                    },
                    error: function () {
                        toastr['error']('Request failed. Check your input and try again.');
                    },
                    complete: function () {
                        $btn.prop('disabled', false).html('<i class="la la-plus"></i> Create Furni');
                    }
                });
            });
        },

        // ------------------------------------------------------------------
        // Navigation buttons
        // ------------------------------------------------------------------

        initNavButtons: function () {
            $('#btnShowList, #btnShowList2').on('click', function () {
                furniCreator.loadList();
            });
            $('#btnShowCreate').on('click', function () {
                $('#createFurniForm')[0].reset();
                $('.rotation-preview').hide();
                showPanel('furniCreatorForm');
            });
            $('#btnReloadList').on('click', function () {
                furniCreator.loadList();
            });
            $('#btnBackToList').on('click', function () {
                furniCreator.loadList();
            });
            $('#btnAddToGame').on('click', function () {
                furniCreator.addToGame();
            });
            $('#btnDeleteItem').on('click', function () {
                furniCreator.deleteItem();
            });
        },

        // ------------------------------------------------------------------
        // Item list datatable
        // ------------------------------------------------------------------

        loadList: function () {
            showPanel('furniCreatorList');

            $.ajax({
                url: '/housekeeping/api/furniCreator/getItems',
                type: 'post',
                headers: { 'Authorization': 'housekeeping_furni_creator' },
                dataType: 'json',
                success: function (data) {
                    furniCreator.renderList(data);
                },
                error: function () {
                    toastr['error']('Failed to load furni list.');
                }
            });
        },

        renderList: function (jsonData) {
            var $el = $('#kt_datatable_furni_list');
            if ($el.data('ktDatatable')) {
                $el.KTDatatable('destroy');
            }

            $el.KTDatatable({
                data: {
                    type: 'local',
                    source: jsonData,
                    pageSize: 20
                },
                layout: { scroll: false, footer: false },
                sortable: true,
                pagination: true,
                columns: [
                    { field: 'id', title: '#', width: 60, type: 'number' },
                    { field: 'public_name', title: 'Public Name' },
                    { field: 'type', title: 'Type', width: 60 },
                    {
                        field: 'status',
                        title: 'Status',
                        width: 110,
                        template: function (row) {
                            var badge = 'warning';
                            if (row.status === 'pending') badge = 'info';
                            if (row.status === 'done')    badge = 'success';
                            return '<span class="kt-badge kt-badge--' + badge + ' kt-badge--inline">' + row.status + '</span>';
                        }
                    },
                    { field: 'created_at', title: 'Created At', width: 160 },
                    {
                        field: 'Actions',
                        title: '',
                        sortable: false,
                        width: 80,
                        overflow: 'visible',
                        textAlign: 'right',
                        autoHide: false,
                        template: function (row) {
                            return '<a class="btn btn-sm btn-clean btn-icon furni-detail-btn" data-id="' + row.id + '" title="View"><i class="flaticon-eye"></i></a>';
                        }
                    }
                ]
            });

            $el.off('click', '.furni-detail-btn').on('click', '.furni-detail-btn', function (e) {
                e.preventDefault();
                var id = $(this).data('id');
                furniCreator.openDetail(id);
            });
        },

        // ------------------------------------------------------------------
        // Detail panel
        // ------------------------------------------------------------------

        openDetail: function (id) {
            currentItemId = id;
            showPanel('furniCreatorDetail');

            $('#detailTitle').text('Furni #' + id);
            $('#btnAddToGame').hide();
            $('#processingIndicator').hide();
            $('#nitroPreviewContainer').hide();
            $('#rotationImages').empty();
            $('#previewPlaceholder').show();

            furniCreator.refreshDetail(id);
        },

        refreshDetail: function (id) {
            $.ajax({
                url: '/housekeeping/api/furniCreator/getItemById',
                type: 'post',
                headers: { 'Authorization': 'housekeeping_furni_creator' },
                data: { id: id },
                dataType: 'json',
                success: function (data) {
                    furniCreator.renderDetail(data);
                },
                error: function () {
                    toastr['error']('Failed to load item details.');
                }
            });
        },

        renderDetail: function (item) {
            var fields = [
                ['ID',                    item.id],
                ['Public Name',           item.public_name],
                ['Item Name',             item.item_name || '—'],
                ['Sprite ID',             item.sprite_id  || '—'],
                ['Type',                  item.type],
                ['Width × Length',        item.width + ' × ' + item.length],
                ['Stack Height',          item.stack_height],
                ['Interaction Type',      item.interaction_type],
                ['Interaction Modes',     item.interaction_modes_count],
                ['Catalog Page ID',       item.page_id],
                ['Catalog Name',          item.catalog_name],
                ['Cost (credits/points)', item.cost_credits + ' / ' + item.cost_points],
                ['Status',                item.status],
                ['Nitro File',            item.nitro_file || '—'],
                ['Created At',            item.created_at],
            ];

            var rows = '';
            $.each(fields, function (i, f) {
                rows += '<tr><th class="w-50">' + f[0] + '</th><td>' + f[1] + '</td></tr>';
            });
            $('#detailTable').html(rows);

            clearPoll();

            if (item.status === 'processing') {
                $('#processingIndicator').show();
                $('#nitroPreviewContainer').hide();
                $('#btnAddToGame').hide();
                pollTimer = setInterval(function () {
                    furniCreator.pollStatus(item.id);
                }, 4000);

            } else if (item.status === 'pending') {
                $('#processingIndicator').hide();
                $('#nitroPreviewContainer').show();
                $('#btnAddToGame').show().prop('disabled', false);
                furniCreator.renderPreview(item);

            } else if (item.status === 'done') {
                $('#processingIndicator').hide();
                $('#nitroPreviewContainer').show();
                $('#btnAddToGame').show().prop('disabled', true).text('Added to Game ✓');
                furniCreator.renderPreview(item);
            }
        },

        renderPreview: function (item) {
            var $container = $('#rotationImages');
            $container.empty();
            $('#previewPlaceholder').hide();

            if (!item.images) return;

            var images;
            try { images = JSON.parse(item.images); } catch (e) { return; }

            $.each(images, function (rotKey, filename) {
                var src = '/uploads/furni_creator/' + encodeURIComponent(item.id) + '/' + encodeURIComponent(filename) + '?t=' + Date.now();
                $container.append(
                    '<div class="text-center kt-margin-r-10 kt-margin-b-10">' +
                    '<small class="d-block text-muted">Rotation ' + $('<span>').text(rotKey.replace('rotation_', '')).html() + '</small>' +
                    '<img src="' + src + '" style="max-height:64px;border:1px solid #ddd;">' +
                    '</div>'
                );
            });
        },

        // ------------------------------------------------------------------
        // Status polling
        // ------------------------------------------------------------------

        pollStatus: function (id) {
            $.ajax({
                url: '/housekeeping/api/furniCreator/getStatus',
                type: 'post',
                headers: { 'Authorization': 'housekeeping_furni_creator' },
                data: { id: id },
                dataType: 'json',
                success: function (data) {
                    if (data.status !== 'processing') {
                        clearPoll();
                        furniCreator.refreshDetail(id);
                        toastr['info']('Furni #' + id + ' is now ' + data.status + '!');
                    }
                }
            });
        },

        // ------------------------------------------------------------------
        // Add to Game
        // ------------------------------------------------------------------

        addToGame: function () {
            if (!currentItemId) return;
            if (!confirm('Add this furni to the game? This action cannot be undone.')) return;

            var $btn = $('#btnAddToGame');
            $btn.prop('disabled', true).text('Adding…');

            $.ajax({
                url: '/housekeeping/api/furniCreator/addToGame',
                type: 'post',
                headers: { 'Authorization': 'housekeeping_furni_creator' },
                data: { id: currentItemId },
                dataType: 'json',
                success: function (data) {
                    if (data.status === 'success') {
                        toastr['success'](data.message);
                        furniCreator.refreshDetail(currentItemId);
                    } else {
                        toastr['error'](data.message || 'Failed to add to game.');
                        $btn.prop('disabled', false).html('<i class="la la-check"></i> Add to Game');
                    }
                },
                error: function () {
                    toastr['error']('Request failed.');
                    $btn.prop('disabled', false).html('<i class="la la-check"></i> Add to Game');
                }
            });
        },

        // ------------------------------------------------------------------
        // Delete item
        // ------------------------------------------------------------------

        deleteItem: function () {
            if (!currentItemId) return;
            if (!confirm('Delete this furni creation job?')) return;

            $.ajax({
                url: '/housekeeping/api/furniCreator/deleteItem',
                type: 'post',
                headers: { 'Authorization': 'housekeeping_furni_creator' },
                data: { id: currentItemId },
                dataType: 'json',
                success: function (data) {
                    if (data.status === 'success') {
                        toastr['success'](data.message);
                        furniCreator.loadList();
                    } else {
                        toastr['error'](data.message || 'Failed to delete item.');
                    }
                },
                error: function () {
                    toastr['error']('Request failed.');
                }
            });
        }
    };

}();

jQuery(document).ready(function () {
    furniCreator.init();
});
