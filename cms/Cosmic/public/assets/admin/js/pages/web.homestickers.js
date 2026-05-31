var homestickers = function () {

    var ajaxPost = function (url, data, callback) {
        var instance = new WebPostInterface.init();
        instance.post(url, data, callback);
    };

    var showNotification = function (type, msg) {
        if (typeof KTApp !== 'undefined' && KTApp.alert) {
            KTApp.alert({ type: type, message: msg });
        } else {
            alert(msg);
        }
    };

    return {
        init: function () {
            homestickers.bindItems();
            homestickers.bindCategories();
        },

        // ── Items ────────────────────────────────────────────────────────────

        bindItems: function () {

            // Show categories panel
            $(".showCategories").off("click").on("click", function () {
                $("#itemsList").hide();
                $("#categoriesList").show();
            });

            $(".backToItems").off("click").on("click", function () {
                $("#categoriesList").hide();
                $("#itemsList").show();
            });

            // Create sticker
            $(".createItem").off("click").on("click", function () {
                homestickers.openItemForm(null);
            });

            // Edit sticker (delegated)
            $(document).off("click", ".editItem").on("click", ".editItem", function () {
                var id       = $(this).data("id");
                var data     = $(this).data("data");
                var name     = $(this).data("name");
                var category = $(this).data("category");
                var price    = $(this).data("price");
                homestickers.openItemForm({ id: id, data: data, name: name, category: category, price: price });
            });

            // Delete sticker (delegated)
            $(document).off("click", ".deleteItem").on("click", ".deleteItem", function () {
                var id = $(this).data("id");
                if (!confirm("Delete this sticker?")) return;
                var csrftoken = $("[name=csrftoken]").val();
                ajaxPost("/housekeeping/api/homestickers/deleteitem", { id: id, csrftoken: csrftoken }, function (result) {
                    if (result.status === "success") {
                        $("tr").filter(function () {
                            return $(this).find(".deleteItem[data-id=" + id + "]").length > 0;
                        }).remove();
                    }
                    showNotification(result.status, result.message);
                });
            });

            // Item form submit
            $("#itemForm").off("submit").on("submit", function (e) {
                e.preventDefault();
                var id       = $("[name=itemId]").val();
                var data     = $("[name=data]").val();
                var name     = $("[name=name]").val();
                var category = $("[name=category]").val();
                var price    = $("[name=price]").val();
                var csrftoken = $("[name=csrftoken]").val();

                if (id) {
                    ajaxPost("/housekeeping/api/homestickers/updateitem",
                        { id: id, data: data, name: name, category: category, price: price, csrftoken: csrftoken },
                        function (result) {
                            showNotification(result.status, result.message);
                            if (result.status === "success") homestickers.goBackItem();
                        }
                    );
                } else {
                    ajaxPost("/housekeeping/api/homestickers/createitem",
                        { data: data, name: name, category: category, price: price, type: "s", csrftoken: csrftoken },
                        function (result) {
                            showNotification(result.status, result.message);
                            if (result.status === "success") homestickers.goBackItem();
                        }
                    );
                }
            });

            $("#goBackItem").off("click").on("click", function () {
                homestickers.goBackItem();
            });
        },

        openItemForm: function (item) {
            $(".itemFormTitle").text(item ? "Edit sticker" : "Create sticker");
            $("[name=itemId]").val(item ? item.id : "");
            $("[name=data]").val(item ? item.data : "");
            $("[name=name]").val(item ? item.name : "");
            $("[name=price]").val(item ? item.price : 0);

            if (item) {
                $("[name=category] option[value='" + item.category + "']").prop("selected", true);
                var previewSrc = "/assets/images/homestickers/" + item.data + ".gif";
                $("#stickerPreview").attr("src", previewSrc).show();
            } else {
                $("#stickerPreview").hide();
            }

            // Live preview on filename change
            $("[name=data]").off("input.preview").on("input.preview", function () {
                var val = $(this).val().replace(/[^a-zA-Z0-9_\-]/g, '');
                if (val) {
                    $("#stickerPreview").attr("src", "/assets/images/homestickers/" + val + ".gif").show();
                } else {
                    $("#stickerPreview").hide();
                }
            });

            $("#itemsList").hide();
            $("#categoriesList").hide();
            $("#itemManage").show();
        },

        goBackItem: function () {
            $("#itemManage").hide();
            $("#itemsList").show();
        },

        // ── Categories ───────────────────────────────────────────────────────

        bindCategories: function () {

            // Create category
            $(".createCategory").off("click").on("click", function () {
                homestickers.openCategoryForm(null);
            });

            // Edit category (delegated)
            $(document).off("click", ".editCategory").on("click", ".editCategory", function () {
                var id   = $(this).data("id");
                var name = $(this).data("name");
                homestickers.openCategoryForm({ id: id, name: name });
            });

            // Delete category (delegated)
            $(document).off("click", ".deleteCategory").on("click", ".deleteCategory", function () {
                var id = $(this).data("id");
                if (!confirm("Delete this category?")) return;
                var csrftoken = $("[name=csrftoken]").val();
                ajaxPost("/housekeeping/api/homestickers/deletecategory", { id: id, csrftoken: csrftoken }, function (result) {
                    if (result.status === "success") {
                        $("tr[data-id=" + id + "]").remove();
                    }
                    showNotification(result.status, result.message);
                });
            });

            // Category form submit
            $("#categoryForm").off("submit").on("submit", function (e) {
                e.preventDefault();
                var id       = $("[name=categoryId]").val();
                var name     = $("[name=catName]").val();
                var csrftoken = $("[name=csrftoken]").val();

                if (id) {
                    ajaxPost("/housekeeping/api/homestickers/updatecategory",
                        { id: id, name: name, csrftoken: csrftoken },
                        function (result) {
                            showNotification(result.status, result.message);
                            if (result.status === "success") homestickers.goBackCategory();
                        }
                    );
                } else {
                    ajaxPost("/housekeeping/api/homestickers/createcategory",
                        { name: name, type: "s", csrftoken: csrftoken },
                        function (result) {
                            showNotification(result.status, result.message);
                            if (result.status === "success") homestickers.goBackCategory();
                        }
                    );
                }
            });

            $("#goBackCategory").off("click").on("click", function () {
                homestickers.goBackCategory();
            });
        },

        openCategoryForm: function (cat) {
            $(".categoryFormTitle").text(cat ? "Edit category" : "Create category");
            $("[name=categoryId]").val(cat ? cat.id : "");
            $("[name=catName]").val(cat ? cat.name : "");

            $("#categoriesList").hide();
            $("#itemsList").hide();
            $("#categoryManage").show();
        },

        goBackCategory: function () {
            $("#categoryManage").hide();
            $("#categoriesList").show();
        }
    };
}();

$(document).ready(function () {
    homestickers.init();
});
