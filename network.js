function simulate(data, svg) {
    const width = parseInt(svg.attr("viewBox").split(' ')[2]);
    const height = parseInt(svg.attr("viewBox").split(' ')[3]);
    const mainGroup = svg.append("g").attr("transform", "translate(0, 50)");

    // Calculate node degrees
    const nodeDegree = {};
    data.links.forEach(link => {
        [link.source, link.target].forEach(nodeId => {
            nodeDegree[nodeId] = (nodeDegree[nodeId] || 0) + 1;
        });
    });

    // Define radius scale based on node degree
    const scaleRadius = d3.scaleSqrt()
        .domain(d3.extent(Object.values(nodeDegree)))
        .range([3, 12]);

    // Calculate country counts
    const countryCounts = {};
    data.nodes.forEach(node => {
        const countries = node["Affiliation Countries"];
        if (countries) {
            countries.forEach(country => {
                countryCounts[country] = (countryCounts[country] || 0) + 1;
            });
        }
    });

    // Get top 10 countries
    const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    // Color scale for countries
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(topCountries);

    // Get color by country
    const getColorByCountry = (countries) => {
        if (countries) {
            let maxCount = -1;
            let selectedCountry = null;
            countries.forEach(country => {
                const index = topCountries.indexOf(country);
                if (index !== -1 && countryCounts[country] > maxCount) {
                    maxCount = countryCounts[country];
                    selectedCountry = country;
                }
            });
            return selectedCountry ? colorScale(topCountries.indexOf(selectedCountry)) : "#A9A9A9";
        }
        return "#A9A9A9";
    };

    // Append link elements (lines)
    const linkElements = mainGroup.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".line")
        .data(data.links)
        .enter()
        .append("line")
        .attr("stroke", "grey");

    // Clean Publisher string for class names
    const cleanPublisherClass = (publisher) => {
        return "gr" + publisher.toString().replace(/\s+/g, '').replace(/[.,/]/g, '');
    };

    // Append node elements (circles)
    const nodeElements = mainGroup.append("g")
        .attr('transform', `translate(${width / 2},${height / 2})`)
        .selectAll(".circle")
        .data(data.nodes)
        .enter()
        .append('g')
        .attr("class", d => cleanPublisherClass(d.Publisher))
        .on("mouseover", (event, nodeData) => {
            const affiliations = nodeData["Affiliation"];
            nodeElements.selectAll("circle")
                .style("opacity", (d) => {
                    if (d["Affiliation"]) {
                        return affiliations.some(affiliation => d["Affiliation"].includes(affiliation)) ? 1 : 0.2;
                    }
                    return 0.2;
                });
        })
        .on("mouseout", () => {
            nodeElements.selectAll("circle").style("opacity", 1);
        })
        .on("click", (event, nodeData) => {
            const tooltip = d3.select(".tooltip");
            tooltip.transition().duration(200).style("opacity", 0.9);
            tooltip.html(`Author: ${nodeData.Authors}<br>Affiliation: ${nodeData.Affiliation.join(", ")}`)
                .style("left", `${event.pageX + 5}px`)
                .style("top", `${event.pageY - 28}px`);

            tooltip.transition().delay(10000).duration(200).style("opacity", 0);
        });

    // Append circles for nodes
    nodeElements.append("circle")
        .attr("r", d => scaleRadius(nodeDegree[d.id] || 0))
        .attr("fill", d => getColorByCountry(d["Affiliation Countries"]));

    // Force Simulation
    let forceSimulation = d3.forceSimulation(data.nodes)
        .force("collide", d3.forceCollide().radius(d => scaleRadius(nodeDegree[d.id]) * 1.2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("charge", d3.forceManyBody().strength(-50))
        .force("link", d3.forceLink(data.links).id(d => d.id).strength(0.5))
        .on("tick", ticked);

    // Update forces when sliders change
    function updateForces() {
        const chargeStrength = parseInt(document.getElementById("chargeStrength").value);
        const collisionRadius = parseInt(document.getElementById("collisionRadius").value);
        const linkStrength = parseFloat(document.getElementById("linkStrength").value);

        forceSimulation
            .force("charge", d3.forceManyBody().strength(chargeStrength))
            .force("collide", d3.forceCollide().radius(d => scaleRadius(nodeDegree[d.id]) * collisionRadius / 12))
            .force("link", d3.forceLink(data.links).id(d => d.id).strength(linkStrength))
            .alpha(1)  // Restart simulation immediately
            .restart();
    }

    // Event listeners for sliders
    document.getElementById("chargeStrength").addEventListener("input", updateForces);
    document.getElementById("collisionRadius").addEventListener("input", updateForces);
    document.getElementById("linkStrength").addEventListener("input", updateForces);

    // Update node and link positions on each tick
    function ticked() {
        nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
        linkElements
            .attr("x1", d => d.source.x)
            .attr("x2", d => d.target.x)
            .attr("y1", d => d.source.y)
            .attr("y2", d => d.target.y);
    }

    // Zoom functionality
    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([1, 8])
        .on("zoom", ({ transform }) => mainGroup.attr("transform", transform)));
}
