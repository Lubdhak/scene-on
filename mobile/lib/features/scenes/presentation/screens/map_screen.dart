import 'package:flutter/material.dart';

class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // TODO: Replace with actual Mapbox widget
          Container(
            color: Colors.grey[300],
            child: const Center(
              child: Text('Map will appear here'),
            ),
          ),
          // Scene control button
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Center(
              child: FloatingActionButton.extended(
                onPressed: () {
                  // TODO: Toggle scene ON/OFF
                },
                icon: const Icon(Icons.power_settings_new),
                label: const Text('Turn Scene ON'),
              ),
            ),
          ),
          // Top bar with actions
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    CircleAvatar(
                      backgroundColor: Colors.white,
                      child: IconButton(
                        icon: const Icon(Icons.person),
                        onPressed: () {
                          // TODO: Navigate to personas
                        },
                      ),
                    ),
                    CircleAvatar(
                      backgroundColor: Colors.white,
                      child: IconButton(
                        icon: const Icon(Icons.inbox),
                        onPressed: () {
                          // TODO: Navigate to inbox
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
