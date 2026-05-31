-- Camera settings for Nitro Docker stack
UPDATE `emulator_settings` SET `value` = 'http://localhost:8082/camera/' WHERE `key` = 'camera.url';
UPDATE `emulator_settings` SET `value` = '0' WHERE `key` = 'camera.use.https';
UPDATE `emulator_settings` SET `value` = '/var/www/html/public/camera/' WHERE `key` = 'imager.location.output.camera';
UPDATE `emulator_settings` SET `value` = '/var/www/html/public/camera/thumbnail/' WHERE `key` = 'imager.location.output.thumbnail';
