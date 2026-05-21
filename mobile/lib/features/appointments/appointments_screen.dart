import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';

class AppointmentsScreen extends StatefulWidget {
  const AppointmentsScreen({super.key});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await api.dio.get('/appointments/', queryParameters: {'page_size': 50});
      _items = res.data['data'] ?? [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _cancel(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel appointment?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes, cancel')),
        ],
      ),
    );
    if (confirm == true) {
      await api.dio.post('/appointments/$id/cancel', data: {'reason': 'patient_request'});
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Appointments')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/appointments/book'),
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemBuilder: (_, i) {
                  final a = _items[i];
                  return Card(
                    child: ListTile(
                      title: Text(a['code']),
                      subtitle: Text('${a['starts_at']?.substring(0, 16).replaceAll('T', ' ')} · ${a['status']}'),
                      trailing: ['requested', 'confirmed', 'pending_confirmation']
                              .contains(a['status'])
                          ? IconButton(
                              icon: const Icon(Icons.close, color: Colors.red),
                              onPressed: () => _cancel(a['id'] as int),
                            )
                          : null,
                    ),
                  );
                },
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemCount: _items.length,
              ),
            ),
    );
  }
}
