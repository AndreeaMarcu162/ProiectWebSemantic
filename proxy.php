<?php
$endpoint = "http://localhost:8081/rdf4j-server/repositories/grafexamen";

$headers = [
  "Content-Type: application/sparql-query",
  "Accept: application/sparql-results+json"
];

$query = file_get_contents("php://input");

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_POSTFIELDS, $query);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
