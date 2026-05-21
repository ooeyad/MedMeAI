import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_state.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(child: ListTile(title: const Text('Full name'), subtitle: Text(user?['full_name'] ?? ''))),
          Card(child: ListTile(title: const Text('Email'), subtitle: Text(user?['email'] ?? ''))),
          Card(child: ListTile(title: const Text('Roles'), subtitle: Text(((user?['roles'] ?? []) as List).join(', ')))),
          Card(child: ListTile(title: const Text('Language'), subtitle: Text(user?['preferred_language'] ?? 'en'))),
        ],
      ),
    );
  }
}
