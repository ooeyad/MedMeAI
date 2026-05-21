import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_state.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final user = auth.user;
    return Drawer(
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            UserAccountsDrawerHeader(
              accountName: Text(user?['full_name'] ?? ''),
              accountEmail: Text(user?['email'] ?? ''),
              currentAccountPicture: CircleAvatar(
                child: Text((user?['full_name'] ?? '?').toString()[0]),
              ),
            ),
            _tile(context, Icons.home_outlined, 'Home', '/'),
            _tile(context, Icons.calendar_month_outlined, 'Appointments', '/appointments'),
            _tile(context, Icons.verified_user_outlined, 'KYC documents', '/kyc'),
            _tile(context, Icons.smart_toy_outlined, 'AI Assistant', '/ai'),
            _tile(context, Icons.person_outline, 'Profile', '/profile'),
            const Spacer(),
            ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Sign out'),
              onTap: () async {
                await context.read<AuthState>().signOut();
                if (context.mounted) context.go('/login');
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(BuildContext ctx, IconData icon, String label, String route) {
    return ListTile(
      leading: Icon(icon),
      title: Text(label),
      onTap: () { Navigator.pop(ctx); ctx.push(route); },
    );
  }
}
