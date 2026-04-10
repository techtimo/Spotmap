<?php
// Quick test of VRM API connectivity
$token = '7b38727316dd384635a69a4a5faf8e8a6aa6952d935c3f55a1b2f50e8e5493ee';
$installation_id = '522142';

echo "=== Testing Victron VRM API ===\n";
echo "Installation ID: $installation_id\n";
echo "Token: " . substr($token, 0, 10) . "...\n\n";

$url = 'https://vrmapi.victronenergy.com/v2/installations/' . rawurlencode($installation_id) . '/widgets/GPS';

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_HTTPHEADER    => ['X-Authorization: Token ' . $token],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_VERBOSE        => false,
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

if ($curl_error) {
    echo "cURL Error: $curl_error\n";
    exit(1);
}

echo "HTTP Status: $http_code\n";
echo "Response:\n";
$json = json_decode($response, true);
echo json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";

if (!empty($json['success']) && !empty($json['records']['data']['attributes'])) {
    $attrs = $json['records']['data']['attributes'];
    echo "\n=== GPS Data ===\n";
    echo "Latitude (attr 4):  " . ($attrs[4]['valueFloat'] ?? 'null') . "\n";
    echo "Longitude (attr 5): " . ($attrs[5]['valueFloat'] ?? 'null') . "\n";
    echo "Speed (attr 142):   " . ($attrs[142]['valueFloat'] ?? 'null') . " m/s\n";
    echo "Altitude (attr 584): " . ($attrs[584]['valueFloat'] ?? 'null') . " m\n";
    echo "Seconds Ago:        " . ($attrs['secondsAgo']['value'] ?? 'null') . "\n";
}
?>
