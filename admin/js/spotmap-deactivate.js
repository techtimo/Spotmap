(function ($) {
    'use strict';

    var orig = document.getElementById('deactivate-spotmap');
    if (!orig) {
        return;
    }
    var deactivateHref = orig.href;

    function openAndDeactivate(url) {
        window.open(url, '_blank');
        window.location.href = deactivateHref;
    }

    var $dialog = $(
        '<div title="Before you go...">' +
            '<p><strong>Spotmap is a hobby project I pour a lot of sweat and love into. It would mean the world to me to know why you\'re moving on.</strong></p>' +
            '<p>Would you mind leaving a quick note?</p>' +
            '<p><strong>Note:</strong> If you later <em>delete</em> the plugin, all tracked points and settings will be permanently removed.</p>' +
        '</div>'
    );

    $dialog.dialog({
        autoOpen: false,
        modal: true,
        width: 510,
        buttons: [
            {
                text: 'Post on WordPress.org',
                'class': 'button button-primary',
                click: function () {
                    openAndDeactivate('https://wordpress.org/support/plugin/spotmap/');
                },
            },
            {
                text: 'Post on GitHub',
                'class': 'button button-primary',
                click: function () {
                    openAndDeactivate('https://github.com/techtimo/spotmap/issues/new');
                },
            },
            {
                text: 'Skip & Deactivate',
                'class': 'button',
                click: function () { window.location.href = deactivateHref; },
            },
        ],
    });

    $(orig).on('click', function (e) {
        e.preventDefault();
        $dialog.dialog('open');
    });

})(jQuery);
