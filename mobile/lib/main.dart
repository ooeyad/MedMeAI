import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/auth/auth_state.dart';
import 'core/router.dart';
import 'core/theme.dart';

void main() {
  runApp(const MedMeApp());
}

class MedMeApp extends StatelessWidget {
  const MedMeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState()..bootstrap(),
      child: Consumer<AuthState>(
        builder: (context, auth, _) {
          final router = buildRouter(auth);
          return MaterialApp.router(
            title: 'MedMeAI',
            theme: appTheme,
            routerConfig: router,
            debugShowCheckedModeBanner: false,
          );
        },
      ),
    );
  }
}
