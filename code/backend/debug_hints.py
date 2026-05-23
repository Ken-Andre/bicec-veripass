
import os
import sys
import importlib
from pydantic import TypeAdapter
from typing import Optional, Any, Dict

# Add the current directory to sys.path
sys.path.append(os.getcwd())

def test_imports():
    modules_to_test = [
        "app.core.security",
        "app.modules.auth.jwt_service",
        "app.core.logging",
        "app.modules.notifications.service",
        "app.core.pagination",
    ]
    
    for module_name in modules_to_test:
        print(f"Testing module: {module_name}")
        try:
            module = importlib.import_module(module_name)
            # Find all functions and check their type hints
            import inspect
            for name, obj in inspect.getmembers(module):
                if inspect.isfunction(obj):
                    try:
                        # Pydantic 2.x TypeAdapter can check function signatures if they are used as fields,
                        # but normally you use TypeAdapter on the type hint itself.
                        hints = inspect.get_annotations(obj)
                        for param_name, hint in hints.items():
                            if "dict" in str(hint):
                                print(f"  Found potential problematic hint in {name}: {param_name} -> {hint}")
                                try:
                                    TypeAdapter(hint).core_schema
                                    print(f"    OK: {hint} evaluated successfully")
                                except Exception as e:
                                    print(f"    FAILED: {hint} evaluation error: {e}")
                    except Exception as e:
                         print(f"  Error inspecting {name}: {e}")
        except Exception as e:
            print(f"  FAILED to import {module_name}: {e}")

if __name__ == "__main__":
    test_imports()
