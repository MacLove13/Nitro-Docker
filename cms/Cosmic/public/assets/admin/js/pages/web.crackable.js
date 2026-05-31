var crackable = function () {

    var currentPrizes = [];

    var _escapeDiv = document.createElement('div');
    function escapeHtml(str) {
        _escapeDiv.textContent = str || '';
        return _escapeDiv.innerHTML;
    }

    return {

        init: function () {
            crackable.loadList();

            $('#backToList').off('click').on('click', function () {
                crackable.showList();
            });

            $('#savePrizesBtn').off('click').on('click', function () {
                crackable.savePrizes();
            });

            $('#furniSearchBtn').off('click').on('click', function () {
                crackable.searchFurni();
            });

            $('#furniSearchInput').off('keypress').on('keypress', function (e) {
                if (e.which === 13) crackable.searchFurni();
            });

            // Use delegated event handlers bound once to stable parent containers
            $('#prizesList').off('change', '.prize-weight-input').on('change', '.prize-weight-input', function () {
                var idx       = parseInt($(this).data('index'));
                var newWeight = parseInt($(this).val()) || 1;
                if (newWeight < 1) newWeight = 1;
                $(this).val(newWeight);
                currentPrizes[idx].weight = newWeight;
                crackable.recalcPercentages();
            });

            $('#prizesList').off('click', '.remove-prize-btn').on('click', '.remove-prize-btn', function () {
                var idx = parseInt($(this).data('index'));
                currentPrizes.splice(idx, 1);
                crackable.renderPrizes();
            });

            $('#furniSearchList').off('click', '.add-furni-btn').on('click', '.add-furni-btn', function () {
                var itemId   = parseInt($(this).data('item-id'));
                var itemName = $(this).data('item-name');
                var pubName  = $(this).data('public-name');

                var exists = false;
                $.each(currentPrizes, function (i, p) {
                    if (p.item_id === itemId) { exists = true; return false; }
                });

                if (exists) {
                    toastr.warning('Este furni já está na lista de prêmios.');
                    return;
                }

                currentPrizes.push({ item_id: itemId, item_name: itemName, public_name: pubName, weight: 100 });
                crackable.renderPrizes();
                toastr.success('Furni adicionado à lista.');
            });
        },

        loadList: function () {
            $.ajax({
                url: '/housekeeping/api/crackable/getList',
                type: 'post',
                headers: { 'Authorization': 'housekeeping' },
                dataType: 'json',
                beforeSend: function () {
                    blockPageInterface.init();
                },
                success: function (data) {
                    crackable.initDatatable(data);
                    blockPageInterface.stop();
                },
                error: function () {
                    blockPageInterface.stop();
                    toastr.error('Falha ao carregar a lista de Crackables.');
                }
            });
        },

        initDatatable: function (jsonObj) {
            if ($('#kt_datatable_crackable').length === 0) return;

            $('#kt_datatable_crackable').KTDatatable({
                data: {
                    type: 'local',
                    source: jsonObj,
                    pageSize: 20
                },
                layout: {
                    scroll: false,
                    footer: false
                },
                sortable: true,
                pagination: true,
                search: {
                    input: $('#crackableSearch')
                },
                columns: [
                    {
                        field: 'item_id',
                        title: '#',
                        type: 'number',
                        width: 70
                    },
                    {
                        field: 'item_name',
                        title: 'Item Name'
                    },
                    {
                        field: 'public_name',
                        title: 'Nome Público'
                    },
                    {
                        field: 'count',
                        title: 'Qtd. Prêmios',
                        width: 120
                    },
                    {
                        field: 'Actions',
                        title: 'Ações',
                        sortable: false,
                        width: 100,
                        overflow: 'visible',
                        textAlign: 'left',
                        autoHide: false,
                        template: function () {
                            return '<a class="btn btn-sm btn-clean btn-icon btn-icon-sm crackableEditBtn" title="Gerenciar prêmios"><i class="flaticon2-edit"></i></a>';
                        }
                    }
                ]
            });

            $('#kt_datatable_crackable').off('click', '.crackableEditBtn').on('click', '.crackableEditBtn', function (e) {
                e.preventDefault();
                var row    = $(e.target).closest('.kt-datatable__row');
                var itemId = row.find('[data-field="item_id"]').text().trim();
                crackable.showDetail(itemId);
            });
        },

        showDetail: function (itemId) {
            $.ajax({
                url: '/housekeeping/api/crackable/getDetail',
                type: 'post',
                headers: { 'Authorization': 'housekeeping' },
                data: { item_id: itemId },
                dataType: 'json',
                beforeSend: function () {
                    blockPageInterface.init();
                },
                success: function (data) {
                    blockPageInterface.stop();

                    if (data.status !== 'success') {
                        toastr.error(data.message || 'Erro ao carregar detalhes.');
                        return;
                    }

                    currentPrizes = data.prizes ? data.prizes.slice() : [];
                    $('#currentCrackableId').val(data.item_id);
                    $('#crackableDetailTitle').text('Crackable: ' + data.item_name + ' (' + data.public_name + ')');
                    $('#furniSearchResults').hide();
                    $('#furniSearchInput').val('');

                    crackable.renderPrizes();
                    crackable.showDetailView();
                },
                error: function () {
                    blockPageInterface.stop();
                    toastr.error('Falha ao carregar detalhes do Crackable.');
                }
            });
        },

        renderPrizes: function () {
            var totalWeight = 0;
            $.each(currentPrizes, function (i, p) {
                totalWeight += parseInt(p.weight) || 0;
            });

            var html = '';

            if (currentPrizes.length === 0) {
                html = '<div class="alert alert-warning">Nenhum prêmio cadastrado.</div>';
            } else {
                html += '<table class="table table-bordered table-striped">';
                html += '<thead><tr><th>#</th><th>Item Name</th><th>Nome Público</th><th>Peso</th><th>%</th><th>Ações</th></tr></thead><tbody>';

                $.each(currentPrizes, function (i, p) {
                    var weight = parseInt(p.weight) || 0;
                    var pct    = totalWeight > 0 ? Math.round((weight / totalWeight) * 10000) / 100 : 0;
                    html += '<tr data-index="' + i + '">';
                    html += '<td>' + escapeHtml(String(p.item_id)) + '</td>';
                    html += '<td>' + escapeHtml(p.item_name) + '</td>';
                    html += '<td>' + escapeHtml(p.public_name) + '</td>';
                    html += '<td><input type="number" class="form-control form-control-sm prize-weight-input" data-index="' + i + '" value="' + weight + '" min="1" style="width:80px;"></td>';
                    html += '<td class="pct-cell">' + pct + '%</td>';
                    html += '<td><a class="btn btn-sm btn-danger remove-prize-btn" data-index="' + i + '" title="Remover"><i class="la la-trash"></i></a></td>';
                    html += '</tr>';
                });

                html += '</tbody></table>';
            }

            $('#prizesList').html(html);
        },

        recalcPercentages: function () {
            var totalWeight = 0;
            $.each(currentPrizes, function (i, p) {
                totalWeight += parseInt(p.weight) || 0;
            });

            $('.prize-weight-input').each(function () {
                var idx    = parseInt($(this).data('index'));
                var weight = parseInt($(this).val()) || 0;
                var pct    = totalWeight > 0 ? Math.round((weight / totalWeight) * 10000) / 100 : 0;
                $(this).closest('tr').find('.pct-cell').text(pct + '%');
            });
        },

        searchFurni: function () {
            var query = $('#furniSearchInput').val().trim();
            if (!query) return;

            $.ajax({
                url: '/housekeeping/api/crackable/getFurniByName',
                type: 'post',
                headers: { 'Authorization': 'housekeeping' },
                data: { query: query },
                dataType: 'json',
                beforeSend: function () {
                    blockPageInterface.init();
                },
                success: function (data) {
                    blockPageInterface.stop();
                    crackable.renderSearchResults(data);
                },
                error: function () {
                    blockPageInterface.stop();
                    toastr.error('Falha ao buscar furnis.');
                }
            });
        },

        renderSearchResults: function (results) {
            if (!results || results.length === 0) {
                $('#furniSearchList').html('<div class="col-12"><div class="alert alert-info">Nenhum furni encontrado.</div></div>');
                $('#furniSearchResults').show();
                return;
            }

            var html = '';
            $.each(results, function (i, item) {
                html += '<div class="col-md-3 col-sm-6 kt-margin-b-10">';
                html += '<div class="kt-portlet kt-portlet--bordered add-furni-btn" style="cursor:pointer;" ';
                html += 'data-item-id="' + item.id + '" ';
                html += 'data-item-name="' + escapeHtml(item.item_name) + '" ';
                html += 'data-public-name="' + escapeHtml(item.public_name) + '" ';
                html += 'title="Adicionar à lista">';
                html += '<div class="kt-portlet__body text-center">';
                html += '<div><small class="kt-font-bold">' + escapeHtml(item.item_name) + '</small></div>';
                html += '<div><small>' + escapeHtml(item.public_name) + '</small></div>';
                html += '<div class="kt-margin-t-5"><span class="btn btn-xs btn-primary"><i class="la la-plus"></i> Adicionar</span></div>';
                html += '</div></div></div>';
            });

            $('#furniSearchList').html(html);
            $('#furniSearchResults').show();
        },

        savePrizes: function () {
            var itemId = $('#currentCrackableId').val();
            var parts  = [];

            $.each(currentPrizes, function (i, p) {
                var weight = parseInt(p.weight) || 1;
                parts.push(p.item_id + ':' + weight);
            });

            var prizesString = parts.join(';');

            $.ajax({
                url: '/housekeeping/api/crackable/savePrizes',
                type: 'post',
                headers: { 'Authorization': 'housekeeping' },
                data: { item_id: itemId, prizes: prizesString },
                dataType: 'json',
                beforeSend: function () {
                    blockPageInterface.init();
                },
                success: function (data) {
                    blockPageInterface.stop();
                    if (data.status === 'success') {
                        toastr.success(data.message || 'Prêmios salvos com sucesso!');
                    } else {
                        toastr.error(data.message || 'Erro ao salvar prêmios.');
                    }
                },
                error: function () {
                    blockPageInterface.stop();
                    toastr.error('Falha ao comunicar com o servidor.');
                }
            });
        },

        showList: function () {
            $('#crackableDetail').hide();
            $('#crackableList').show();
            currentPrizes = [];
        },

        showDetailView: function () {
            $('#crackableList').hide();
            $('#crackableDetail').show();
            $('html, body').animate({ scrollTop: 0 }, 'fast');
        }

    };

}();

jQuery(document).ready(function () {
    crackable.init();
});
