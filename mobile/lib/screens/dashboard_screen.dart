import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'emergency_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  LatLng _vesselLocation = const LatLng(10.182, 76.177); // Default near Munambam port
  String _activeAlert = '';
  Color _alertColor = Colors.transparent;
  bool _showBanner = false;

  // Define spatial boundaries of Spawning/Restricted zones
  final List<Map<String, dynamic>> _zones = [
    {
      'id': 'wadge_bank',
      'name': 'Wadge Bank Marine Ecosystem (Restricted)',
      'severity': 'high',
      'polygon': [
        const LatLng(8.00, 76.50),
        const LatLng(8.40, 76.50),
        const LatLng(8.40, 77.20),
        const LatLng(8.00, 77.20),
      ]
    },
    {
      'id': 'ashtamudi_estuary',
      'name': 'Ashtamudi Estuary Sanctuary (Restricted)',
      'severity': 'high',
      'polygon': [
        const LatLng(8.90, 76.45),
        const LatLng(9.05, 76.45),
        const LatLng(9.05, 76.58),
        const LatLng(8.90, 76.58),
      ]
    },
    {
      'id': 'vembanad_conservation',
      'name': 'Vembanad seagrass Sanctuary (Restricted)',
      'severity': 'medium',
      'polygon': [
        const LatLng(9.80, 76.15),
        const LatLng(10.15, 76.15),
        const LatLng(10.15, 76.28),
        const LatLng(9.80, 76.28),
      ]
    },
    {
      'id': 'kadalu_nesting',
      'name': 'Kadalundi Turtle Nesting Zone (Restricted)',
      'severity': 'high',
      'polygon': [
        const LatLng(11.10, 75.75),
        const LatLng(11.25, 75.75),
        const LatLng(11.25, 75.88),
        const LatLng(11.10, 75.88),
      ]
    }
  ];

  // Ray-casting point in polygon algorithm
  bool _isPointInPolygon(LatLng point, List<LatLng> polygon) {
    double x = point.longitude;
    double y = point.latitude;
    bool inside = false;

    for (int i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      double xi = polygon[i].longitude;
      double yi = polygon[i].latitude;
      double xj = polygon[j].longitude;
      double yj = polygon[j].latitude;

      bool intersect = ((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Check collision when location changes
  void _checkLocationAlerts(LatLng point) {
    String matchedZoneName = '';
    String severity = '';

    for (var zone in _zones) {
      if (_isPointInPolygon(point, zone['polygon'] as List<LatLng>)) {
        matchedZoneName = zone['name'] as String;
        severity = zone['severity'] as String;
        break;
      }
    }

    setState(() {
      _vesselLocation = point;
      if (matchedZoneName.isNotEmpty) {
        _activeAlert = '🚨 RESTRICTED AREA DETECTED\nInside $matchedZoneName!';
        _alertColor = severity == 'high' ? const Color(0xFFff7759) : Colors.amber;
        _showBanner = true;
      } else {
        _activeAlert = '';
        _alertColor = Colors.transparent;
        _showBanner = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Generate Polygon classes for Map Layer
    final List<Polygon> mapPolygons = _zones.map((zone) {
      final isHigh = zone['severity'] == 'high';
      return Polygon(
        points: zone['polygon'] as List<LatLng>,
        color: isHigh ? const Color(0x33ff7759) : const Color(0x22ffb059),
        borderColor: isHigh ? const Color(0xFFff7759) : const Color(0xFFffb059),
        borderStrokeWidth: 2,
        isFilled: true,
      );
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Thalassa Fisherman Companion', style: TextStyle(fontFamily: 'monospace', fontSize: 16)),
        backgroundColor: const Color(0xFF181a20),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () {
              // Return to default
              _checkLocationAlerts(const LatLng(10.182, 76.177));
            },
          )
        ],
      ),
      body: Stack(
        children: [
          // Flutter Map View (Leaflet clone)
          FlutterMap(
            options: MapOptions(
              center: const LatLng(10.0, 75.9),
              zoom: 8,
              onTap: (tapPosition, point) {
                _checkLocationAlerts(point);
              },
            ),
            children: [
              // CartoDB Dark Matter Tiles (ideal dark mode contrast)
              TileLayer(
                urlTemplate: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.thalassa.app',
              ),
              
              // Spawning zones vector overlay
              PolygonLayer(polygons: mapPolygons),
              
              // Vessel GPS Marker
              MarkerLayer(
                markers: [
                  Marker(
                    width: 32,
                    height: 32,
                    point: _vesselLocation,
                    builder: (ctx) => Stack(
                      alignment: Alignment.center,
                      children: [
                        // Pulse glow ring
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF1863dc).withOpacity(0.4),
                          ),
                        ),
                        // Inner core
                        Container(
                          width: 12,
                          height: 12,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                            boxShadow: [
                              BoxShadow(color: Color(0xFF1863dc), blurRadius: 6, spreadRadius: 2),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Top Violations Banner
          if (_showBanner)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Card(
                color: const Color(0xFF1c1214),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(color: _alertColor, width: 1.5),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: _alertColor, size: 30),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _activeAlert,
                          style: TextStyle(
                            color: _alertColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Bottom Position HUD & Legend
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Info HUD
                Card(
                  color: const Color(0xFF181a20).withOpacity(0.95),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(color: Color(0xFF282b35), width: 1),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'MOCK TELEMETRY SENSOR',
                          style: TextStyle(
                            color: Color(0xFF00b48a),
                            fontFamily: 'monospace',
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'GPS Lat: ${_vesselLocation.latitude.toStringAsFixed(4)}°N  |  Lng: ${_vesselLocation.longitude.toStringAsFixed(4)}°E',
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            color: Colors.white,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          '💡 Tap anywhere on the map to simulate GPS position and check spawning ban boundaries.',
                          style: TextStyle(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 12),
                
                // SOS Panic Button Trigger
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (context) => const EmergencyScreen()),
                    );
                  },
                  icon: const Icon(Icons.sos_outlined, color: Colors.white, size: 24),
                  label: const Text(
                    'SOS EMERGENCY OVERRIDE',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFff7759),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 8,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
