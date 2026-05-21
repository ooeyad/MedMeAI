import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_client.dart';

class KycScreen extends StatefulWidget {
  const KycScreen({super.key});

  @override
  State<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends State<KycScreen> {
  int? _patientId;
  Map<String, dynamic>? _status;
  bool _busy = false;

  final _kinds = const [
    'national_id_front', 'national_id_back', 'passport', 'residency',
    'insurance_front', 'insurance_back', 'consent',
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() => _busy = true);
    try {
      final me = (await api.dio.get('/auth/me')).data;
      _patientId = me['patient_id'];
      if (_patientId != null) {
        final res = await api.dio.get('/kyc/patients/$_patientId');
        _status = Map<String, dynamic>.from(res.data);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _upload(String kind) async {
    if (_patientId == null) return;
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;
    setState(() => _busy = true);
    try {
      final form = FormData.fromMap({
        'file': await MultipartFile.fromFile(file.path, filename: file.name),
        'kind': kind,
      });
      await api.dio.post('/kyc/patients/$_patientId/documents', data: form, options: Options(contentType: 'multipart/form-data'));
      await api.dio.post('/kyc/patients/$_patientId/extract');
      _bootstrap();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('KYC documents')),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.verified_user),
                    title: Text('Status: ${_status?['status'] ?? 'pending'}'),
                    subtitle: const Text('Upload your ID + insurance card. We extract the fields automatically.'),
                  ),
                ),
                const SizedBox(height: 12),
                ..._kinds.map((k) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.upload_file_outlined),
                        title: Text(k.replaceAll('_', ' ')),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _upload(k),
                      ),
                    )),
              ],
            ),
    );
  }
}
