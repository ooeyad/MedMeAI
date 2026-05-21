import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_state.dart';
import '../../core/api/api_client.dart';
import '../shared/app_drawer.dart';

class PatientHomeScreen extends StatefulWidget {
  const PatientHomeScreen({super.key});

  @override
  State<PatientHomeScreen> createState() => _PatientHomeScreenState();
}

class _PatientHomeScreenState extends State<PatientHomeScreen> {
  List<dynamic> _appointments = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await api.dio.get('/appointments/', queryParameters: {'page_size': 10});
      _appointments = res.data['data'] ?? [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(title: Text('Hi, ${user?['full_name'] ?? ''} 👋')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/appointments/book'),
        icon: const Icon(Icons.add),
        label: const Text('Book'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                leading: const Icon(Icons.smart_toy_outlined),
                title: const Text('AI Assistant'),
                subtitle: const Text('Book, reschedule, ask anything.'),
                onTap: () => context.push('/ai'),
              ),
            ),
            const SizedBox(height: 12),
            Text('Upcoming appointments', style: Theme.of(context).textTheme.titleMedium),
            if (_loading) const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
            if (!_loading && _appointments.isEmpty)
              const Padding(padding: EdgeInsets.all(24), child: Text('No upcoming appointments. Tap Book to schedule one.')),
            ..._appointments.map((a) => Card(
                  child: ListTile(
                    title: Text(a['code'] ?? ''),
                    subtitle: Text('${a['status']} · ${a['starts_at']?.substring(0, 16).replaceAll('T', ' ')}'),
                    trailing: Text(a['doctor']?['user']?['full_name'] ?? '', style: const TextStyle(fontSize: 12)),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
