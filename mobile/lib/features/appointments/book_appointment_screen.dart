import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';

class BookAppointmentScreen extends StatefulWidget {
  const BookAppointmentScreen({super.key});

  @override
  State<BookAppointmentScreen> createState() => _BookAppointmentScreenState();
}

class _BookAppointmentScreenState extends State<BookAppointmentScreen> {
  List<dynamic> _branches = [];
  List<dynamic> _doctors = [];
  List<dynamic> _slots = [];
  int? _branchId;
  int? _doctorId;
  String? _slot;
  final _reasonCtrl = TextEditingController();
  int _step = 0;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    final res = await api.dio.get('/branches/');
    setState(() => _branches = res.data['data'] ?? []);
  }

  Future<void> _loadDoctors(int branchId) async {
    final res = await api.dio.get('/doctors/', queryParameters: {'branch_id': branchId});
    setState(() {
      _doctors = res.data['data'] ?? [];
      _step = 1;
    });
  }

  Future<void> _loadSlots(int doctorId) async {
    final res = await api.dio.get('/doctors/$doctorId/availability');
    setState(() {
      _slots = res.data['slots'] ?? [];
      _step = 2;
    });
  }

  Future<void> _book() async {
    setState(() => _submitting = true);
    try {
      // Use 'me' patient via /auth/me
      final me = (await api.dio.get('/auth/me')).data;
      final patientId = me['patient_id'];
      if (patientId == null) {
        throw 'Your user is not linked to a patient profile.';
      }
      await api.dio.post('/appointments/', data: {
        'patient_id': patientId,
        'doctor_id': _doctorId,
        'branch_id': _branchId,
        'starts_at': _slot,
        'reason': _reasonCtrl.text,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Appointment booked!')));
        context.go('/appointments');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Book appointment')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            Stepper(
              currentStep: _step,
              onStepTapped: (i) => setState(() => _step = i),
              controlsBuilder: (_, __) => const SizedBox.shrink(),
              steps: [
                Step(
                  title: const Text('Branch'),
                  content: Column(
                    children: _branches.map<Widget>((b) => ListTile(
                          title: Text(b['name']),
                          subtitle: Text(b['city'] ?? ''),
                          onTap: () { _branchId = b['id']; _loadDoctors(b['id']); },
                          selected: _branchId == b['id'],
                        )).toList(),
                  ),
                ),
                Step(
                  title: const Text('Doctor'),
                  content: Column(
                    children: _doctors.map<Widget>((d) => ListTile(
                          title: Text(d['user']?['full_name'] ?? ''),
                          subtitle: Text((d['specialties'] ?? []).map((s) => s['name']).join(', ')),
                          onTap: () { _doctorId = d['id']; _loadSlots(d['id']); },
                          selected: _doctorId == d['id'],
                        )).toList(),
                  ),
                ),
                Step(
                  title: const Text('Time'),
                  content: Wrap(
                    spacing: 8, runSpacing: 8,
                    children: _slots.take(20).map<Widget>((s) {
                      final selected = _slot == s['starts_at'];
                      return ChoiceChip(
                        label: Text('${s['date']} ${s['start']}'),
                        selected: selected,
                        onSelected: (_) => setState(() { _slot = s['starts_at']; _step = 3; }),
                      );
                    }).toList(),
                  ),
                ),
                Step(
                  title: const Text('Reason & confirm'),
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(controller: _reasonCtrl, decoration: const InputDecoration(labelText: 'Reason (optional)', border: OutlineInputBorder()), maxLines: 3),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: (_submitting || _slot == null || _doctorId == null || _branchId == null) ? null : _book,
                        child: Text(_submitting ? 'Booking…' : 'Book appointment'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
