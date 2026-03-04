# The namepool here

[https://user-images.githubusercontent.com/93150691/226236121-375ea64f-b4a1-4cc0-8fad-a6fb33226840.mp4](https://github.com/user-attachments/assets/50bf231d-529c-4f7e-9c94-9b10a21d17cc)

<br>

Namepool is the fully-featured mempool visualizer, explorer, and API service running at `namepool.bit`.

It is an open-source project developed and operated for the benefit of the Namecoin community.

# Installation Methods

Namepool can be self-hosted on a wide variety of your own hardware, ranging from a simple one-click installation on a Raspberry Pi full-node distro all the way to a robust production instance on a powerful FreeBSD server. 

Most people should use a <a href="#one-click-installation">one-click install method</a>.

Other install methods are meant for developers and others with experience managing servers. If you want support for your own production instance of Namepool, or if you'd like to have your own instance of Namepool run by the namepool.bit team on their own global ISP infrastructure—check out <a href="https://namepool.bit/enterprise" target="_blank">Namepool Enterprise®</a>.

<a id="one-click-installation"></a>
## One-Click Installation

Namepool can be conveniently installed on the following full-node distros: 
- [Umbrel](https://github.com/getumbrel/umbrel)
- [RaspiBlitz](https://github.com/rootzoll/raspiblitz)
- [RoninDojo](https://code.samourai.io/ronindojo/RoninDojo)
- [myNode](https://github.com/mynodebtc/mynode)
- [StartOS](https://github.com/Start9Labs/start-os)

**We highly recommend you deploy your own Namepool instance this way.** No matter which option you pick, you'll be able to get your own fully-sovereign instance of Namepool up quickly without needing to fiddle with any settings.

## Advanced Installation Methods

Namepool can be installed in other ways too, but we only recommend doing so if you're a developer, have experience managing servers, or otherwise know what you're doing.

- See the [`docker/`](./docker/) directory for instructions on deploying Namepool with Docker.
- See the [`backend/`](./backend/) and [`frontend/`](./frontend/) directories for manual install instructions oriented for developers.
- See the [`production/`](./production/) directory for guidance on setting up a more serious Namepool instance designed for high performance at scale.
