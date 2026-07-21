import 'package:flutter/material.dart';
import 'screens/dashboard_screen.dart';

void main() {
  runApp(const MatsyaDrishtiApp());
}

class MatsyaDrishtiApp extends StatelessWidget {
  const MatsyaDrishtiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Matsya Drishti Mobile',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF00b48a), // Mint Green
        scaffoldBackgroundColor: const Color(0xFF0d0e12), // Deep Space Blue/Black
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00b48a),
          secondary: Color(0xFF1863dc), // Action Blue
          error: Color(0xFFff7759), // Coral Warning/Error
          surface: Color(0xFF181a20), // Dark surface cards
        ),
        textTheme: const TextTheme(
          titleLarge: TextStyle(
            fontFamily: 'Roboto',
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
            color: Colors.white,
          ),
          bodyMedium: TextStyle(
            fontFamily: 'Roboto',
            color: Color(0xFFa0aec0), // Muted text
          ),
        ),
        useMaterial3: true,
      ),
      home: const DashboardScreen(),
    );
  }
}
