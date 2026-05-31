<?php
namespace App\Controllers\Admin;

use App\Models\Admin;
use Core\View;

class AutoUpdate
{
    /** @var string Auto-updater service base URL */
    private string $serviceUrl;

    public function __construct()
    {
        $this->serviceUrl = rtrim(getenv('AUTO_UPDATER_URL') ?: 'http://auto-updater:5001', '/');
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    public function view(): void
    {
        View::renderTemplate('Admin/Management/autoupdate.html', [
            'permission' => 'housekeeping_auto_update',
        ]);
    }

    // -------------------------------------------------------------------------
    // Trigger manual scrape
    // -------------------------------------------------------------------------

    public function triggerScrape(): void
    {
        $result = $this->callService('/api/scrape', 'POST');
        echo json_encode($result);
        exit;
    }

    // -------------------------------------------------------------------------
    // SWF Packs
    // -------------------------------------------------------------------------

    public function getPacks(): void
    {
        $page    = max(1, (int) (input()->post('page')->value    ?? 1));
        $perPage = min(100, max(1, (int) (input()->post('per_page')->value ?? 50)));
        $status  = input()->post('status')->value ?? null;

        $result = $this->callService('/api/packs?' . http_build_query(array_filter([
            'page'     => $page,
            'per_page' => $perPage,
            'status'   => $status,
        ], fn($v) => $v !== null && $v !== '')));

        echo json_encode($result);
        exit;
    }

    public function processPack(): void
    {
        $id = (int) (input()->post('id')->value ?? 0);
        if ($id <= 0) {
            echo json_encode(['error' => 'Invalid ID']);
            exit;
        }
        $result = $this->callService("/api/packs/{$id}/process", 'POST');
        echo json_encode($result);
        exit;
    }

    // -------------------------------------------------------------------------
    // Furniture
    // -------------------------------------------------------------------------

    public function getFurniture(): void
    {
        $page    = max(1, (int) (input()->post('page')->value    ?? 1));
        $perPage = min(100, max(1, (int) (input()->post('per_page')->value ?? 50)));
        $status  = input()->post('status')->value ?? null;

        $result = $this->callService('/api/furniture?' . http_build_query(array_filter([
            'page'     => $page,
            'per_page' => $perPage,
            'status'   => $status,
        ], fn($v) => $v !== null && $v !== '')));

        echo json_encode($result);
        exit;
    }

    public function processFurniture(): void
    {
        $id = (int) (input()->post('id')->value ?? 0);
        if ($id <= 0) {
            echo json_encode(['error' => 'Invalid ID']);
            exit;
        }
        $result = $this->callService("/api/furniture/{$id}/process", 'POST');
        echo json_encode($result);
        exit;
    }

    // -------------------------------------------------------------------------
    // Effects
    // -------------------------------------------------------------------------

    public function getEffects(): void
    {
        $page    = max(1, (int) (input()->post('page')->value    ?? 1));
        $perPage = min(100, max(1, (int) (input()->post('per_page')->value ?? 50)));
        $status  = input()->post('status')->value ?? null;

        $result = $this->callService('/api/effects?' . http_build_query(array_filter([
            'page'     => $page,
            'per_page' => $perPage,
            'status'   => $status,
        ], fn($v) => $v !== null && $v !== '')));

        echo json_encode($result);
        exit;
    }

    public function processEffect(): void
    {
        $id = (int) (input()->post('id')->value ?? 0);
        if ($id <= 0) {
            echo json_encode(['error' => 'Invalid ID']);
            exit;
        }
        $result = $this->callService("/api/effects/{$id}/process", 'POST');
        echo json_encode($result);
        exit;
    }

    // -------------------------------------------------------------------------
    // Logs
    // -------------------------------------------------------------------------

    public function getLogs(): void
    {
        $limit    = min(500, max(1, (int) (input()->post('limit')->value    ?? 200)));
        $category = input()->post('category')->value ?? null;
        $logDate  = input()->post('date')->value     ?? null;

        $result = $this->callService('/api/logs?' . http_build_query(array_filter([
            'limit'    => $limit,
            'category' => $category,
            'date'     => $logDate,
        ], fn($v) => $v !== null && $v !== '')));

        echo json_encode($result);
        exit;
    }

    // -------------------------------------------------------------------------
    // Internal HTTP helper
    // -------------------------------------------------------------------------

    /**
     * Make an HTTP call to the auto-updater service.
     * Returns a decoded array on success, or ['error' => ...] on failure.
     */
    private function callService(string $path, string $method = 'GET'): array
    {
        $url = $this->serviceUrl . $path;
        $ch  = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_FAILONERROR    => false,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, '{}');
        }

        $body     = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            return ['error' => "Service unavailable: {$curlErr}"];
        }

        $decoded = json_decode($body, true);
        if ($decoded === null) {
            return ['error' => "Invalid JSON response (HTTP {$httpCode}): " . substr($body, 0, 200)];
        }

        return $decoded;
    }
}
