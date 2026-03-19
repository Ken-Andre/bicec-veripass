import os
import subprocess
from app.celery import celery_app
from app.core.logging import logger

@celery_app.task(name="app.tasks.maintenance.check_disk_usage")
def check_disk_usage():
    """
    Task to execute the docker_prune.sh script.
    Assumes the script is available at the specified path.
    """
    script_path = "/app/scripts/docker_prune.sh" # Path inside container
    
    if not os.path.exists(script_path):
        logger.error(f"Maintenance script not found at {script_path}")
        return False
        
    try:
        # We need to make sure the script has execution permissions
        os.chmod(script_path, 0o755)
        
        result = subprocess.run(
            [script_path],
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"Disk prune script executed successfully: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Disk prune script failed with exit code {e.returncode}: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"Error executing disk prune script: {e}")
        return False
