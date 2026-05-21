import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _Msg {
  final String role;
  final String content;
  final Map<String, dynamic>? pending;
  _Msg(this.role, this.content, {this.pending});
}

class _AiChatScreenState extends State<AiChatScreen> {
  final _ctrl = TextEditingController();
  final List<_Msg> _msgs = [
    _Msg('system', 'Ask me anything: book, reschedule, find slots, check insurance…'),
  ];
  int? _conversationId;
  bool _busy = false;

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    _ctrl.clear();
    setState(() { _msgs.add(_Msg('user', text)); _busy = true; });
    try {
      final res = await api.dio.post('/ai/chat', data: {
        'message': text,
        if (_conversationId != null) 'conversation_id': _conversationId,
      });
      _conversationId = res.data['conversation_id'];
      _msgs.add(_Msg('assistant', res.data['reply'] ?? '',
          pending: res.data['pending_confirmation'] != null
              ? Map<String, dynamic>.from(res.data['pending_confirmation'])
              : null));
    } catch (e) {
      _msgs.add(_Msg('assistant', 'Error: $e'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirm(String token, String decision) async {
    if (_conversationId == null) return;
    setState(() => _busy = true);
    try {
      final res = await api.dio.post('/ai/chat/$_conversationId/confirm',
          data: {'token': token, 'decision': decision});
      _msgs.add(_Msg('assistant', res.data['reply'] ?? 'Done.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Assistant')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _msgs.length,
              itemBuilder: (_, i) {
                final m = _msgs[i];
                final user = m.role == 'user';
                return Align(
                  alignment: user ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: user ? const Color(0xFF0D7ED9) : Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: user ? null : Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.content, style: TextStyle(color: user ? Colors.white : Colors.black)),
                        if (m.pending != null) ...[
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            children: [
                              FilledButton(onPressed: () => _confirm(m.pending!['token'], 'yes'), child: const Text('Confirm')),
                              OutlinedButton(onPressed: () => _confirm(m.pending!['token'], 'no'), child: const Text('Cancel')),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (_busy) const LinearProgressIndicator(minHeight: 2),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    controller: _ctrl,
                    decoration: const InputDecoration(hintText: 'Ask anything…', border: OutlineInputBorder()),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(icon: const Icon(Icons.send), onPressed: _send),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
