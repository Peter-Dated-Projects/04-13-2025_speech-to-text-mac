from setuptools import setup, find_packages
import pathlib

here = pathlib.Path(__file__).parent
reqs = (here / "requirements.txt").read_text().splitlines()
install_requires = [r.strip() for r in reqs if r.strip() and not r.startswith("#")]


setup(
    name="WhisperCore",
    version="b_0.1",
    author="Peter Zhang",
    packages=find_packages(),  # find all packages under my_module/
    install_requires=install_requires,
    # Tell pip that we have extra non-.py files to include
    include_package_data=True,
    package_data={
        # if your external_data folder is _inside_ a package, e.g. my_module/data:
        "my_module": ["../external_data/*"],
    },
    # Or if you have data outside any package:
    # data_files=[("external_data", ["external_data/some_file.bin"])],
    entry_points={
        # optional: define console scripts
        "console_scripts": [
            "verify=verify:main",
        ],
    },
    zip_safe=False,
)
