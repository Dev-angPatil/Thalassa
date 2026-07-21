import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  // Call dialer function
  void _makePhoneCall(String phoneNumber) async {
    final Uri url = Uri(scheme: 'tel', path: phoneNumber);
    if (await canLaunchUrl(url)) {
      await launchUrl(url);
    } else {
      debugPrint('Could not launch emergency call dialer for $phoneNumber');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF140507), // Extremely dark red/black
      appBar: AppBar(
        title: const Text(
          'EMERGENCY PANIC HUB',
          style: TextStyle(
            color: Color(0xFFff7759),
            fontFamily: 'monospace',
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
            fontSize: 16,
          ),
        ),
        backgroundColor: const Color(0xFF1c080a),
        iconTheme: const IconThemeData(color: Color(0xFFff7759)),
        elevation: 0,
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Large Glowing Distress Icon
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color.fromRGBO(255, 119, 89, 0.08),
                    border: Border.all(color: const Color.fromRGBO(255, 119, 89, 0.3), width: 2),
                  ),
                  child: const Icon(
                    Icons.contact_phone_rounded,
                    color: Color(0xFFff7759),
                    size: 40,
                  ),
                ),
              ),
              
              const SizedBox(height: 20),
              
              const Text(
                'DISTRESS SIGNAL OVERRIDE',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFFff7759),
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select any authority below to launch a single-tap direct satellite/cell emergency call.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white60,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              
              const SizedBox(height: 36),
              
              // Emergency Cards List
              Expanded(
                child: ListView(
                  children: [
                    _buildEmergencyCard(
                      title: 'Indian Coast Guard',
                      number: '1554',
                      subtitle: 'Maritime Search & Rescue Dispatcher',
                      icon: Icons.sailing,
                    ),
                    const SizedBox(height: 16),
                    _buildEmergencyCard(
                      title: 'Kerala Coastal Police',
                      number: '1093',
                      subtitle: 'Local Maritime Law & Safety Support',
                      icon: Icons.shield,
                    ),
                    const SizedBox(height: 16),
                    _buildEmergencyCard(
                      title: 'National Emergency Line',
                      number: '112',
                      subtitle: 'Unified Disaster Response & SOS Link',
                      icon: Icons.emergency,
                    ),
                    const SizedBox(height: 16),
                    _buildEmergencyCard(
                      title: 'INCOIS Tsunami Center',
                      number: '04023886000',
                      subtitle: 'Tsunami & Ocean state Warning Room',
                      icon: Icons.tsunami,
                    ),
                  ],
                ),
              ),
              
              // Cancel Override button
              OutlinedButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFF4a1e22)),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                ),
                child: const Text(
                  'DISMISS OVERRIDE',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmergencyCard({
    required String title,
    required String number,
    required String subtitle,
    required IconData icon,
  }) {
    return Card(
      color: const Color(0xFF1f0b0d),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF4a1e22), width: 1.2),
      ),
      elevation: 4,
      child: InkWell(
        onTap: () => _makePhoneCall(number),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              // Icon Ring
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Color(0xFF2d1215),
                ),
                child: Icon(icon, color: const Color(0xFFff7759), size: 24),
              ),
              const SizedBox(width: 16),
              
              // Texts
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.white54,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'DIAL: $number',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        color: Color(0xFFff7759),
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Dial Arrow
              const Icon(
                Icons.phone_forwarded,
                color: Color(0xFFff7759),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
