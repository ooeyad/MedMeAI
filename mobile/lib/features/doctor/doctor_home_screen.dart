import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../core/auth/auth_state.dart';
import '../../core/api/api_client.dart';
import '../shared/app_drawer.dart';

class DoctorHomeScreen extends StatefulWidget {
  const DoctorHomeScreen({super.key});

  @override
  State<DoctorHomeScreen> createState() => _DoctorHomeScreenState();
}

class _DoctorHomeScreenState extends State<DoctorHomeScreen> {
  List<dynamic> _today = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final today = DateTime.now().toUtc();
      final res = await api.dio.get('/appointments/', queryParameters: {
        'date_from': DateTime(today.year, today.month, today.day).toIso8601String(),
        'date_to': DateTime(today.year, today.month, today.day, 23, 59).toIso8601String(),
        'page_size': 50,
      });
      _today = res.data['data'] ?? [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthState>().user;
    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text("Dr. ${user?['full_name'] ?? ''}"),
        actions: [
          IconButton(onPressed: () => context.push('/ai'), icon: const Icon(Icons.smart_toy_outlined)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text("Today's schedule", style: Theme.of(context).textTheme.titleMedium),
            if (_loading) const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())),
            if (!_loading && _today.isEmpty)
              const Padding(padding: EdgeInsets.all(24), child: Text("Nothing on today's schedule.")),
            ..._today.map((a) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.event),
                    title: Text(a['patient']?['full_name_en'] ?? a['patient']?['code'] ?? ''),
                    subtitle: Text('${a['starts_at']?.substring(11, 16)} · ${a['status']}'),
                    trailing: Text(a['code'] ?? '', style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
