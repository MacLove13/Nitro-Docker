/**
 * Classic Habbo Hotel UI - JavaScript
 * Handles interactive elements for the classic Habbo-style UI
 */

$(document).ready(function() {

    // Motto editing functionality
    $('.habbo-motto-input').on('focus', function() {
        var $input = $(this);
        if ($input.val() === $input.data('placeholder')) {
            $input.val('');
            $input.css('color', '#333');
        }
    }).on('blur', function() {
        var $input = $(this);
        if ($input.val() === '') {
            $input.val($input.data('placeholder'));
            $input.css('color', '#666');
        }
    }).on('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var newMotto = $(this).val();
            if (newMotto === $(this).data('placeholder')) {
                newMotto = '';
            }
            $.ajax({
                url: '/ajax/settings/motto',
                method: 'POST',
                data: {
                    motto: newMotto,
                    csrftoken: $('meta[name="csrf-token"]').attr('content') || ''
                },
                success: function(response) {
                    // Motto updated
                }
            });
            $(this).blur();
        }
    });

    // Trading toggle
    $('.habbo-trading-toggle').on('click', function(e) {
        e.preventDefault();
        $.ajax({
            url: '/ajax/settings/trading',
            method: 'POST',
            success: function(response) {
                if (response && response.status === 'success') {
                    location.reload();
                }
            }
        });
    });

    // Tab navigation active state
    var currentPath = window.location.pathname;
    $('.habbo-tab').each(function() {
        var href = $(this).attr('href');
        if (href && currentPath.indexOf(href) === 0 && href !== '/') {
            $(this).addClass('habbo-tab-active');
        }
    });

    // Sub-navigation active state  
    $('.habbo-subnav a').each(function() {
        var href = $(this).attr('href');
        if (href && currentPath === href) {
            $(this).addClass('active');
        }
    });

});
